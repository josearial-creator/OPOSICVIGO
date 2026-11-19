const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const origin='http://127.0.0.1:8086',api='https://rumbo-entrenador.jose-arial.workers.dev';
const pass='contraseña-de-prueba-movil-para-favoritos-12345678';
const auth='Rumbo '+Buffer.from(pass).toString('base64');
const entries=[
 {puesto:'Auxiliar administrativo C2',organismo:'Xunta de Galicia',grupo:'C2',anio:2026,convocatoria_id:'movil-auxiliar',plazas:10,prioridad:'Alta',inscripcion:'No convocada',fuente:'https://www.xunta.gal/'},
 {puesto:'Administrativo C1',organismo:'Xunta de Galicia',grupo:'C1',anio:2026,convocatoria_id:'movil-administrativo',plazas:50,prioridad:'Alta',inscripcion:'No convocada',fuente:'https://www.xunta.gal/'}
];
const copies=new Map();
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
 const errors=[];
 try{
  async function fresh(width,context=null){
   context??=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   const page=await context.newPage();
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({json:entries}));
   await page.route(api+'/**',route=>{
    const r=route.request(),path=new URL(r.url()).pathname;
    const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS'};
    if(r.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
    if(r.headers().authorization!==auth)return route.fulfill({status:401,headers,json:{error:'No autorizado'}});
    if(path==='/notes'&&r.method()==='GET')return route.fulfill({status:200,headers,json:{notes:[]}});
    if(path==='/favorites'&&r.method()==='GET')
      return route.fulfill({status:200,headers,json:{versions:[...copies.values()].map(x=>({id:x.id,count:x.count,createdAt:x.createdAt})),cursor:null}});
    if(path==='/favorites'&&r.method()==='POST'){
      const snap=r.postDataJSON();
      assert.ok(/^[a-f0-9]{64}$/.test(snap.id));
      assert.equal(JSON.stringify(snap).includes('Auxiliar administrativo'),false,'El Worker jamás recibe nombres en claro');
      if(copies.has(snap.id)&&JSON.stringify(copies.get(snap.id))!==JSON.stringify(snap))return route.fulfill({status:409,headers,json:{error:'ID ocupado'}});
      copies.set(snap.id,snap);
      return route.fulfill({status:201,headers,json:{saved:true,id:snap.id}});
    }
    const m=/^\/favorites\/([a-f0-9]{64})$/.exec(path);
    if(m&&r.method()==='GET'&&copies.has(m[1]))return route.fulfill({status:200,headers,json:{snapshot:copies.get(m[1])}});
    return route.fulfill({status:404,headers,json:{error:'No existe'}});
   });
   await page.goto(origin+'/#convocatorias');
   await page.locator('#rows tr').first().waitFor();
   return {page,context};
  }
  const synced=async(page,n)=>page.waitForFunction(n=>document.querySelector('#favorites-sync-status')?.textContent?.includes('Favoritos sincronizados: '+n+'.'),n,{timeout:60000});
  async function signin(page){
   await page.locator('#rumbo-access-open').click();
   await page.locator('#rumbo-access-password').fill(pass);
   await page.locator('#rumbo-access-submit').click();
   await page.locator('#rumbo-access-dialog').waitFor({state:'hidden'});
  }
  async function toggle(page,name){
   await page.locator('#source').selectOption('');
   await page.locator('#status-filter').selectOption('');
   await page.locator('#only-favs').uncheck();
   await page.locator('#rows tr').filter({hasText:name}).getByRole('button',{name:'Alternar favorito'}).click();
  }
  const laptop=await fresh(1120),mobile=await fresh(390);
  await toggle(laptop.page,'Auxiliar administrativo C2');
  assert.match(await laptop.page.locator('#favorites-sync-status').innerText(),/este dispositivo/i);
  await signin(laptop.page);await synced(laptop.page,1);
  assert.equal(copies.size,1,'El ordenador guarda una copia cifrada');
  await toggle(mobile.page,'Administrativo C1');
  await signin(mobile.page);await synced(mobile.page,2);
  assert.equal(await mobile.page.locator('#count-favs').innerText(),'2','El móvil une los favoritos de ambos dispositivos');
  await laptop.page.locator('#favorites-sync-now').click();await synced(laptop.page,2);
  assert.equal(await laptop.page.locator('#count-favs').innerText(),'2','Ordenador recibe el favorito del móvil');
  await toggle(mobile.page,'Auxiliar administrativo C2');
  await synced(mobile.page,1);
  await laptop.page.locator('#favorites-sync-now').click();await synced(laptop.page,1);
  assert.equal(await laptop.page.locator('#count-favs').innerText(),'1','El borrado intencional se sincroniza, sin resucitar la estrella');
  const secondTab=await fresh(1120,laptop.context);
  assert.equal(await secondTab.page.locator('#count-favs').innerText(),'1');
  await toggle(secondTab.page,'Auxiliar administrativo C2');
  await laptop.page.waitForFunction(()=>document.querySelector('#count-favs')?.textContent==='2',null,{timeout:10000});
  assert.equal(await laptop.page.locator('#count-favs').innerText(),'2','La pestaña abierta actualiza con evento storage');
  await laptop.page.reload();
  assert.equal(await laptop.page.locator('#count-favs').innerText(),'2','No se pierden favoritas al recargar');
  assert.equal(await laptop.page.evaluate(p=>Object.values(localStorage).some(v=>v.includes(p)),pass),false,'La contraseña no se persiste');
  assert.deepEqual(errors,[],'Ningún error de JavaScript');
  await secondTab.context.close();await laptop.context.close();await mobile.context.close();
  console.log('PASS: favoritos cifrados en móvil/escritorio, altas, bajas, otras pestañas y sin secretos guardados.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
