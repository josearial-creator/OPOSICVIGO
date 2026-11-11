const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[]}));
 await page.goto('http://127.0.0.1:8086');
 const dock=page.locator('.mobile-dock');await dock.waitFor();
 const storage=await page.evaluate(()=>JSON.stringify({...localStorage}));
 assert.equal(await page.locator('#diario-menu').isVisible(),false);
 assert.equal(await page.locator('#mi-dia').evaluate(e=>e.getBoundingClientRect().top<400),true);
 for(const width of [320,390,760]){
 await page.setViewportSize({width,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
 for(const a of await dock.locator('a,button').all())assert.ok((await a.boundingBox()).height>=48);
 await dock.getByRole('button',{name:'Más',exact:true}).click();
 assert.equal(await page.locator('#mobile-menu').isVisible(),true);
 await page.locator('#mobile-menu').getByRole('link',{name:'Conexión privada con ChatGPT'}).click();
 assert.equal(await page.locator('#mobile-menu').isVisible(),false);
 await page.waitForFunction(()=>location.hash==='#rumbo-chatgpt-sync');
 await dock.getByRole('link',{name:'Diario',exact:true}).click();
 await page.waitForFunction(()=>location.hash==='#ev-diary');
 assert.equal(await dock.getByRole('link',{name:'Diario',exact:true}).getAttribute('aria-current'),'location');
 }
 await dock.getByRole('button',{name:'Más',exact:true}).click();await page.keyboard.press('Escape');
 assert.equal(await page.locator('#mobile-menu').isVisible(),false);
 assert.equal(await dock.getByRole('button',{name:'Más',exact:true}).getAttribute('aria-expanded'),'false');
 assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),storage,'navigation must not write data');
 await page.setViewportSize({width:1280,height:900});
 assert.equal(await dock.isVisible(),false);assert.equal(await page.locator('.sidebar').isVisible(),true);
 await page.setViewportSize({width:390,height:844});await dock.getByRole('link',{name:'Hoy',exact:true}).click();
 await page.locator('#assistant-capture input').fill('Tarea de prueba móvil');
 await page.locator('#assistant-capture').getByRole('button',{name:'Guardar',exact:true}).click();await page.reload();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('rumbo-asistente-v1')).items.some(x=>x.text==='Tarea de prueba móvil'));
 assert.deepEqual(errors,[]);
 console.log('PASS: navegación 320/390/760, menú/Escape, escritorio, aislamiento y captura persistente.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
