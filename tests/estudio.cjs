const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
 try{
 const page=await browser.newPage();
 await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[{puesto:'Auxiliar de prueba',organismo:'Vigo'}]}));
 await page.goto('http://127.0.0.1:8086');
 await page.getByRole('button',{name:'Detalle',exact:true}).click();
 await page.getByRole('textbox',{name:'Notas personales (solo en este navegador)'}).fill('Apunte anterior');
 await page.locator('#dialog-done').click();
 await page.reload();
 await page.locator('.sidebar .study-nav').getByRole('link',{name:'Apuntes de estudio',exact:true}).click();
 await page.locator('#study-list').getByText('Apunte anterior',{exact:true}).waitFor();
 await page.locator('#study-list').getByRole('button',{name:'Abrir apuntes'}).click();
 assert.equal(await page.locator('#study-text').inputValue(),'Apunte anterior');
 await page.locator('#study-text').fill('Tema 1: repasar mañana <script>bad()</script>');
 await page.locator('#study-save').click();
 await page.getByText('Apuntes guardados en este navegador.',{exact:true}).waitFor();
 await page.reload();
 await page.locator('#study-list').getByRole('button',{name:'Abrir apuntes'}).click();
 assert.equal(await page.locator('#study-text').inputValue(),'Tema 1: repasar mañana <script>bad()</script>');
 assert.equal(await page.locator('#study-list script').count(),0);
 const download=page.waitForEvent('download');await page.locator('#study-export').click();assert.equal((await download).suggestedFilename(),'rumbo-apuntes-estudio.json');
 await page.setViewportSize({width:390,height:844});
 await page.locator('.mobile-dock').getByRole('link',{name:'Estudio',exact:true}).click();
 assert.equal(await page.evaluate(()=>location.hash),'#apuntes-estudio');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log('PASS Estudio: menú, notas existentes, guardado, recarga, exportación, texto seguro y móvil.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
