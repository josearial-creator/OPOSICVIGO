const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox'],headless:true});
 try{
  for(const width of [390,1120]){
   const context=await browser.newContext({viewport:{width,height:850},serviceWorkers:'block'});
   const page=await context.newPage(),errors=[],sent=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[]}));
   page.on('request',r=>{if(r.method()==='POST'&&r.url().startsWith('https:'))sent.push(r.url());});
   await page.goto('http://127.0.0.1:8086/#observatorio-personal');
   await page.locator('#observatorio-personal').waitFor({state:'visible'});
   assert.equal(await page.locator('#obs-private').isVisible(),false);
   assert.equal(await page.locator('#obs-locked').isVisible(),true);
   await page.locator('#obs-password').fill('password-for-local-test-123456789');
   await page.locator('#obs-open').click();
   await page.locator('#obs-private').waitFor({state:'visible',timeout:15000});
   const f=page.locator('#obs-self-form');
   await f.locator('[name=dimension]').selectOption('ansiedad');
   await f.locator('[name=value]').selectOption('3');
   await f.locator('[name=evidence]').fill('Tengo ansiedad durante una tarea.');
   await f.getByRole('button',{name:'Guardar autovaloración'}).click();
   assert.match(await page.locator('#obs-count').innerText(),/1 indicadores/);
   let stored=await page.evaluate(()=>localStorage.getItem('rumbo-observatorio-encrypted-v1'));
   assert.ok(stored&&stored.includes('"cipher"'));
   assert.ok(!stored.includes('Tengo ansiedad')&&!stored.includes('password-for-local-test'));
   await page.locator('#obs-text').fill('Me siento derrotado y necesito resolverlo ya.');
   await page.getByRole('button',{name:'Identificar indicadores'}).click();
   assert.equal(await page.locator('.obs-suggestion').count(),2);
   assert.equal(await page.locator('#obs-count').innerText().then(x=>Number.parseInt(x)),1,'Analizar no guarda automáticamente');
   await page.locator('.obs-suggestion').first().getByRole('button',{name:'Guardar sin puntuación'}).click();
   assert.match(await page.locator('#obs-count').innerText(),/2 indicadores/);
   const entries=await page.locator('#obs-entries .obs-entry').allInnerTexts();
   assert.ok(entries.some(x=>x.includes('sin puntuación')));
   stored=await page.evaluate(()=>localStorage.getItem('rumbo-observatorio-encrypted-v1'));
   assert.ok(!stored.includes('derrotado'));
   await page.getByRole('button',{name:'Preparar resumen de 30 días'}).click();
   assert.equal(await page.locator('#obs-report-text').isVisible(),true);
   assert.match(await page.locator('#obs-report-text').inputValue(),/Autovaloraciones: 1/);
   await page.locator('#obs-lock').click();
   assert.equal(await page.locator('#obs-private').isVisible(),false);
   await page.reload();
   await page.locator('#observatorio-personal').waitFor({state:'visible'});
   await page.locator('#obs-password').fill('password-for-local-test-123456789');
   await page.locator('#obs-open').click();
   await page.locator('#obs-private').waitFor({state:'visible',timeout:15000});
   assert.match(await page.locator('#obs-count').innerText(),/2 indicadores/,'Cifrado recuperado tras reiniciar');
   assert.ok(sent.every(x=>!x.includes('observatorio')),'Observatorio no envía contenidos a ningún endpoint');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'Diseño móvil sin overflow');
   assert.deepEqual(errors,[],'Sin excepciones JS');
   await context.close();
  }
  console.log('PASS Observatorio: bóveda cifrada, fuentes separadas, texto opt-in, informe, persistencia y móvil.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
