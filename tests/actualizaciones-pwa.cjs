const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base='http://127.0.0.1:8086/#mi-dia';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
 try{
  for(const [width,controlled] of [[390,true],[1120,true],[390,false]]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[]}));
   await page.addInitScript(controlled=>{
     const worker=new EventTarget();
     worker.controller=controlled?{scriptURL:'https://example.test/sw.js'}:null;
     const registration={waiting:null,checks:0,update:async()=>{registration.checks++;}};
     worker.register=async()=>registration;
     worker.getRegistration=async()=>registration;
     Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:worker});
     window.__testWorker={
       change(){worker.controller={scriptURL:'https://example.test/new.js'};worker.dispatchEvent(new Event('controllerchange'));},
       checks(){return registration.checks}
     };
   },controlled);
   await page.goto(base);
   await page.waitForFunction(()=>typeof window.RumboUpdates?.available==='function');
   const original=await page.evaluate(()=>({...localStorage}));
   assert.equal(await page.locator('#rumbo-update-banner').isVisible(),false,'No hay anuncio falso al abrir.');
   assert.equal(await page.locator('#rumbo-update-apply-settings').isVisible(),false);
   await page.locator('#rumbo-settings-open').click();
   await page.locator('#rumbo-update-check').click();
   await page.waitForFunction(()=>window.__testWorker.checks()>=1);
   assert.match(await page.locator('#rumbo-update-status').innerText(),/Comprobación realizada/);
   await page.locator('#rumbo-settings-close').click();
   await page.evaluate(()=>window.__testWorker.change());
   if(!controlled){
     assert.equal(await page.locator('#rumbo-update-banner').isVisible(),false,'Primera instalación no es actualización.');
     await page.evaluate(()=>window.__testWorker.change());
   }
   assert.equal(await page.locator('#rumbo-update-banner').isVisible(),true,'Avisar solo tras recibir una versión nueva.');
   await page.once('dialog',d=>d.dismiss());
   await page.locator('#rumbo-update-apply').click();
   assert.equal(await page.locator('#rumbo-update-banner').isVisible(),true,'Cancelar recarga conserva el aviso.');
   await page.locator('#rumbo-update-later').click();
   assert.equal(await page.locator('#rumbo-update-banner').isVisible(),false,'Más tarde permite seguir trabajando.');
   assert.deepEqual(await page.evaluate(()=>({...localStorage})),original,'Comprobar y posponer no cambia datos.');
   await page.locator('#rumbo-settings-open').click();
   assert.equal(await page.locator('#rumbo-update-apply-settings').isVisible(),true,'La actualización pendiente se puede recuperar en Ajustes.');
   await page.locator('#rumbo-settings-close').click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'Sin desbordamiento en móvil.');
   assert.deepEqual(errors,[]);
   await context.close();
  }
  // Regresión: la interfaz debe funcionar si el navegador no implementa Service Workers.
  {
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
     Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:undefined});
   });
   await page.goto(base);
   await page.waitForFunction(()=>typeof window.RumboUpdates?.available==='function');
   await page.locator('#rumbo-settings-open').click();
   await page.locator('#rumbo-update-check').click();
   assert.match(await page.locator('#rumbo-update-status').innerText(),/No se puede comprobar automáticamente/);
   assert.equal(await page.locator('#rumbo-update-banner').isVisible(),false);
   assert.deepEqual(errors,[],'Sin errores de JavaScript por falta de Service Worker.');
   await context.close();
  }
  console.log('PASS: detección PWA, primer registro, actualización controlada, posponer y datos intactos en móvil/escritorio.');
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1);});
