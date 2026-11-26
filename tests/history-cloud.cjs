const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const origin='http://127.0.0.1:8086',url=origin+'/#historial-rumbo';
const api='https://rumbo-entrenador.jose-arial.workers.dev';
const password='clave-demo-historial-cifrado-de-32-caracteres',expected='Rumbo '+Buffer.from(password).toString('base64');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
 const archives=new Map(),notes=[],errors=[];
 try{
  async function prepare(context){
   const page=await context.newPage();
   page.on('pageerror',err=>errors.push(err.message));
   await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({json:[]}));
   await page.route(api+'/**',route=>{
    const req=route.request(),pathname=new URL(req.url()).pathname;
    const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'Authorization, Content-Type','access-control-allow-methods':'GET, POST, PUT, DELETE, OPTIONS'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
    if(req.headers().authorization!==expected)return route.fulfill({status:401,headers,json:{error:'No autorizado'}});
    if(pathname==='/notes'&&req.method()==='GET')return route.fulfill({status:200,headers,json:{notes}});
    if(pathname==='/history'&&req.method()==='GET')return route.fulfill({status:200,headers,json:{versions:[...archives.entries()].map(([id,item])=>({id,count:item.count,createdAt:item.createdAt})),cursor:null}});
    if(pathname==='/history'&&req.method()==='POST'){
     const snapshot=req.postDataJSON();
     if(archives.has(snapshot.id))return route.fulfill({status:409,headers,json:{error:'Conflicto'}});
     archives.set(snapshot.id,snapshot);
     return route.fulfill({status:201,headers,json:{saved:true,id:snapshot.id}});
    }
    const m=pathname.match(/^\/history\/([a-f0-9]{64})$/);
    if(m&&req.method()==='GET'&&archives.has(m[1]))return route.fulfill({status:200,headers,json:{snapshot:archives.get(m[1])}});
    return route.fulfill({status:404,headers,json:{error:'No encontrado'}});
   });
   await page.goto(url);
   await page.locator('#rumbo-access-open').click();
   await page.locator('#rumbo-access-password').fill(password);
   await page.locator('#rumbo-access-submit').click();
   await page.locator('#rumbo-access-dialog').waitFor({state:'hidden'});
   return page;
  }
  const c1=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const page=await prepare(c1);
  const synthetic={type:'rumbo-migracion-local-v1',version:1,reflections:Array.from({length:121},(_,i)=>({
   id:'registro-'+i,recordedAt:'2026-11-05T12:00:00Z',date:'2026-11-05',title:'Reflexión '+i,summary:'DATO PRIVADO SINTETICO '+i,reported:'Solo para esta prueba'
  })),psychology:{days:[{date:'2026-11-05',situations:Array.from({length:10},(_,i)=>({id:'situacion-'+i,text:'Situación '+i})),quick:{text:'Apunte sintético'}}]}};
  await page.locator('#historic-files').setInputFiles({name:'132-ficticios.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(synthetic))});
  await page.locator('#rumbo-settings-open').click();await page.locator('[data-settings-history]').click();
  await page.locator('#historic-import').click();
  await page.locator('#historic-status').getByText(/132 nuevos registros/i).waitFor();
  await page.locator('#historic-cloud-status').getByText(/132 registros guardados en Cloudflare/i).waitFor({timeout:60000});
  assert.equal(archives.size,1);
  const only=[...archives.values()][0];
  assert.equal(only.count,132);
  assert.equal(JSON.stringify(only).includes('DATO PRIVADO SINTETICO'),false,'El servidor no recibe el texto privado');
  assert.equal(await page.locator('#historic-total').innerText(),'132');
  await page.locator('#historic-cloud-retry').click();
  await page.locator('#historic-cloud-status').getByText(/132 registros protegidos/i).waitFor({timeout:60000});
  assert.equal(archives.size,1,'El mismo conjunto no genera duplicados');
  const c2=await browser.newContext({viewport:{width:1120,height:900},serviceWorkers:'block'});
  const restored=await prepare(c2);
  await restored.locator('#historic-cloud-status').getByText(/132 registros protegidos/i).waitFor({timeout:60000});
  assert.equal(await restored.locator('#historic-total').innerText(),'132','Segundo dispositivo recupera el historial al entrar');
  assert.equal(JSON.parse(await restored.evaluate(()=>localStorage.getItem('rumbo-historial-importado-v1'))).entries.length,132);
  assert.equal((await restored.locator('#historic-reflections').innerText()),'121');
  const saved=await restored.evaluate(()=>window.RumboHistoryVault.status());
  assert.equal(saved.archived,132,'Bóveda local conserva la copia restaurada');
  await restored.locator('#rumbo-access-open').click();
  await restored.locator('#rumbo-access-logout').click();
  await restored.waitForFunction(()=>window.RumboSession.available()===false,{timeout:15000});
  assert.equal(archives.size,1,'Salir no elimina la copia remota');
  assert.deepEqual(errors,[],'Sin errores de JavaScript');
  console.log('PASS: 132 registros cifrados, comprobación remota, recuperación en otro navegador, no duplicación, logout.');
  await c2.close();await c1.close();
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1);});
