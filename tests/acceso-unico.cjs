const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const baseUrl='http://127.0.0.1:8086/';
const worker='https://rumbo-entrenador.jose-arial.workers.dev';
const pass='contraseña sintética única 1234567890123';
const auth='Rumbo '+Buffer.from(pass).toString('base64');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
 try{
  for(const width of [390,1120]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   const accessCalls=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[]}));
   await page.route(worker+'/**',route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    const headers={'access-control-allow-origin':baseUrl.slice(0,-1),'access-control-allow-headers':'Authorization, Content-Type','access-control-allow-methods':'GET, POST, PUT, DELETE, OPTIONS'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
    accessCalls.push({path,auth:req.headers().authorization});
    if(req.headers().authorization!==auth)return route.fulfill({status:401,headers,json:{error:'Acceso denegado'}});
    if(path==='/notes'&&req.method()==='GET')return route.fulfill({status:200,headers,json:{notes:[]}});
    if(path==='/training'&&req.method()==='GET')return route.fulfill({status:200,headers,json:{records:[]}});
    return route.fulfill({status:404,headers,json:{error:'Ruta no configurada'}});
   });
   await page.goto(baseUrl+'#mi-espacio');
   assert.equal(await page.evaluate(()=>window.RumboSession.available()),false);
   await page.locator('#rumbo-access-open').click();
   await page.locator('#rumbo-access-password').fill('contraseña incorrecta');
   await page.locator('#rumbo-access-submit').click();
   await page.locator('#rumbo-access-status').getByText(/incorrecta|denegado/i).waitFor();
   assert.equal(await page.evaluate(()=>window.RumboSession.available()),false,'Contraseña inválida no abre sesión');
   await page.locator('#rumbo-access-password').fill(pass);
   await page.locator('#rumbo-access-submit').click();
   await page.locator('#rumbo-access-dialog').waitFor({state:'hidden'});
   await page.locator('#esp-private').waitFor({state:'visible'});
   assert.equal(await page.locator('#rumbo-access-open').innerText(),'Acceso abierto');
   assert.equal(await page.locator('#esp-password').inputValue(),'','No repetir contraseña en Mi espacio');
   assert.equal(await page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('contraseña sintética única'))),false,'No conservar secretos en localStorage');
   assert.equal(await page.evaluate(()=>Object.values(sessionStorage).some(v=>v.includes('contraseña sintética única'))),false,'No conservar secretos en sessionStorage');
   await page.evaluate(()=>{location.hash='#ev-training';});
   await page.locator('#er-private').waitFor({state:'visible'});
   assert.equal(await page.locator('#er-pass').inputValue(),'','Entrenamiento se desbloquea sin reescribir');
   assert.equal(await page.locator('#ps-password').isHidden(),true,'Prácticas reutilizan la sesión');
   assert.equal(accessCalls.filter(x=>x.path==='/training').length>=1,true,'El servidor verifica las credenciales de Entrenamiento');
   assert.equal(accessCalls.some(x=>x.path==='/chat'),false,'Acceso no implica consentimiento ni llamadas a IA');
   await page.locator('#er-archive > summary').click();
   await page.locator('#ps-app > details > summary').click();
   await page.locator('#ps-sync').click();
   await page.locator('#ps-sync-status').getByText(/Sincronización confirmada/i).waitFor();
   const aiToken=await page.evaluate(()=>{
    const box=document.createElement('div');box.id='test-shared-ai';document.body.append(box);
    window.RumboAI.mount(box,null,[],'');
    return box.querySelector('input[type=password]').value;
   });
   assert.equal(aiToken,pass,'Acceso de IA disponible sin volver a teclear');
   assert.equal(await page.locator('#test-shared-ai input[type=checkbox]').first().isChecked(),false,'Consentimiento Gemini no automático');
   await page.locator('#rumbo-access-open').click();
   await page.locator('#rumbo-access-logout').click();
   await page.locator('#esp-private').waitFor({state:'hidden'});
   await page.locator('#er-private').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>window.RumboSession.available()),false);
   assert.equal(await page.locator('#test-shared-ai input[type=password]').inputValue(),'','IA pierde contraseña al salir');
   await page.reload();
   assert.equal(await page.evaluate(()=>window.RumboSession.available()),false,'Recarga no conserva credencial');
   assert.equal(await page.locator('#rumbo-access-open').innerText(),'Acceso privado');
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('PASS: contraseña única validada, Mi espacio, entrenamiento, prácticas opcionales, IA sin consentimiento, cierre y recarga.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
