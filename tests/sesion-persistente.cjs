const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const url='http://127.0.0.1:8086/#inicio',worker='https://rumbo-entrenador.jose-arial.workers.dev';
const pass='clave-ficticia-para-reapertura-de-rumbo-123456789',auth='Rumbo '+Buffer.from(pass).toString('base64');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
 try{
  for(const width of [390,1120]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   const errors=[];
   await context.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[]}));
   await context.route(worker+'/**',r=>{
    const req=r.request(),path=new URL(req.url()).pathname;
    const headers={'access-control-allow-origin':'http://127.0.0.1:8086','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'Authorization, Content-Type'};
    if(req.method()==='OPTIONS')return r.fulfill({status:204,headers,body:''});
    if(req.headers().authorization!==auth)return r.fulfill({status:401,headers,json:{error:'Acceso no autorizado'}});
    if(path==='/notes')return r.fulfill({status:200,headers,json:{notes:[]}});
    if(path==='/training')return r.fulfill({status:200,headers,json:{records:[]}});
    return r.fulfill({status:404,headers,json:{error:'No encontrado'}});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
   await page.waitForFunction(()=>window.RumboSession&&!document.getElementById('rumbo-access-open').textContent.includes('Recuperando'));
   assert.equal(await page.evaluate(()=>window.RumboSession.available()),false);
   await page.locator('#rumbo-access-open').click();
   await page.locator('#rumbo-access-password').fill(pass);
   await page.locator('#rumbo-access-submit').click();
   await page.locator('#rumbo-access-dialog').waitFor({state:'hidden'});
   await page.waitForFunction(()=>window.RumboSession.remembered());
   const stored=await page.evaluate(async()=>{
    const req=indexedDB.open('rumbo-dispositivo-privado-v1');
    const db=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error);});
    const tx=db.transaction('credencial','readonly'),store=tx.objectStore('credencial');
    const key=await new Promise(ok=>{const r=store.get('key');r.onsuccess=()=>ok(r.result);});
    const record=await new Promise(ok=>{const r=store.get('record');r.onsuccess=()=>ok(r.result);});
    db.close();return {extractable:key?.extractable,format:record?.version,text:JSON.stringify(record),local:JSON.stringify(localStorage),session:JSON.stringify(sessionStorage)};
   });
   assert.equal(stored.extractable,false,'Clave del dispositivo no exportable');
   assert.equal(stored.format,1,'Credencial cifrada persistida');
   assert.equal(stored.text.includes(pass),false,'Sin contraseña en claro en IndexedDB');
   assert.equal(stored.local.includes(pass),false,'Sin contraseña en claro en localStorage');
   assert.equal(stored.session.includes(pass),false,'Sin contraseña en claro en sessionStorage');
   await page.close();
   const reopened=await context.newPage();reopened.on('pageerror',e=>errors.push(e.message));await reopened.goto(url);
   await reopened.waitForFunction(()=>window.RumboSession.available(),null,{timeout:30000});
   assert.equal(await reopened.evaluate(()=>window.RumboSession.remembered()),true,'Sesión recordada al reabrir Rumbo');
   const second=await context.newPage();second.on('pageerror',e=>errors.push(e.message));await second.goto(url);
   await second.waitForFunction(()=>window.RumboSession.available(),null,{timeout:30000});
   await reopened.locator('#rumbo-settings-open').click();
   assert.equal(await reopened.locator('#rumbo-settings-logout').isVisible(),true,'Cerrar sesión aparece en Ajustes');
   await reopened.locator('#rumbo-settings-logout').click();
   await reopened.waitForFunction(()=>!window.RumboSession.available());
   await second.waitForFunction(()=>!window.RumboSession.available(),null,{timeout:12000});
   await reopened.reload();
   await reopened.waitForFunction(()=>document.getElementById('rumbo-access-open').textContent==='Acceso privado');
   assert.equal(await reopened.evaluate(()=>window.RumboSession.available()),false,'Cerrar sesión invalida acceso tras recarga');
   // El usuario debe volver a validarse después de cerrar voluntariamente.
   await reopened.locator('#rumbo-access-open').click();
   await reopened.locator('#rumbo-access-password').fill(pass);
   await reopened.locator('#rumbo-access-submit').click();
   await reopened.locator('#rumbo-access-dialog').waitFor({state:'hidden'});
   await reopened.waitForFunction(()=>window.RumboSession.remembered());
   await reopened.evaluate(()=>window.RumboNavigation.go('ev-training'));
   await reopened.locator('#er-private').waitFor({state:'visible'});
   const field=reopened.locator('#er-form textarea').first();
   await field.fill('Borrador sintético sin guardar');
   let deny=true;
   reopened.on('dialog',async d=>deny?d.dismiss():d.accept());
   await reopened.locator('#rumbo-settings-open').click();
   await reopened.locator('#rumbo-settings-logout').click();
   assert.equal(await reopened.evaluate(()=>window.RumboSession.available()),true,'Cancelar el aviso conserva sesión');
   deny=false;
   await reopened.locator('#rumbo-settings-logout').click();
   await reopened.waitForFunction(()=>!window.RumboSession.available());
   assert.deepEqual(errors,[],'Sin excepciones JavaScript');
   await context.close();
  }
  console.log('PASS: apertura persistente, clave cifrada por dispositivo, dos pestañas, cierre en Ajustes y borrador protegido.');
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1);});
