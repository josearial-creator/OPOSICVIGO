const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),headless:true,args:['--no-sandbox']});
 const storage=new Map(),password='clave privada larga de prueba 1234567890';
 const base='http://127.0.0.1:8086';
 async function openPage(viewport){
  const page=await browser.newPage({viewport});
  page.on('dialog',d=>d.accept());
  await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({json:[]}));
  await page.route('https://rumbo-entrenador.jose-arial.workers.dev/training**',async route=>{
   const request=route.request(),method=request.method(),path=new URL(request.url()).pathname;
   const headers={'access-control-allow-origin':base,'access-control-allow-headers':'Authorization, Content-Type','access-control-allow-methods':'GET,POST,DELETE,OPTIONS'};
   if(method==='OPTIONS')return route.fulfill({status:204,headers,body:''});
   if(request.headers().authorization!=='Rumbo '+Buffer.from(password).toString('base64'))return route.fulfill({status:401,headers,json:{error:'Acceso no autorizado'}});
   if(method==='GET')return route.fulfill({status:200,headers,json:{records:[...storage.values()]}});
   if(method==='POST'){
    const body=request.postDataJSON();
    if(body.situacion||body.pensamiento||body.emocion||body.conducta)return route.fulfill({status:400,headers,json:{error:'Texto no cifrado'}});
    storage.set(body.id,body);
    return route.fulfill({status:201,headers,json:{record:body}});
   }
   if(method==='DELETE'){storage.delete(path.split('/').at(-1));return route.fulfill({status:200,headers,json:{deleted:true}});}
   return route.fulfill({status:404,headers,json:{error:'Ruta'}});
  });
  await page.goto(base+'/#ev-training');
  await page.locator('#er-connect').waitFor();
  return page;
 }
 try{
  const desktop=await openPage({width:1280,height:850});
  await desktop.evaluate(()=>localStorage.setItem('rumbo-history-test-sentinel','HISTORIAL_INTACTO'));
  await desktop.locator('#er-pass').fill('contraseña equivocada');
  await desktop.locator('#er-connect').click();
  await desktop.waitForFunction(()=>document.querySelector('#er-status')?.textContent.includes('No se pudo conectar'));
  assert.equal(await desktop.locator('#er-private').isVisible(),false);
  await desktop.locator('#er-pass').fill(password);
  await desktop.locator('#er-connect').click();
  await desktop.locator('#er-private').waitFor({state:'visible'});
  const values={situacion:'Situación de prueba privada',pensamiento:'Pensamiento de prueba privado',emocion:'Incertidumbre de prueba',conducta:'Pausé diez segundos'};
  for(const [key,value]of Object.entries(values))await desktop.locator('#er-form [name='+key+']').fill(value);
  await desktop.locator('#er-save').click();
  await desktop.waitForFunction(()=>document.querySelector('#er-status')?.textContent.includes('Guardado cifrado confirmado'));
  assert.equal(storage.size,1);
  const record=[...storage.values()][0];
  assert.ok(record.cipher.length>20);
  for(const value of Object.values(values))assert.ok(!JSON.stringify(record).includes(value),'No debe enviarse texto sin cifrar');
  assert.equal(await desktop.locator('#er-body tr').count(),1);
  assert.equal(await desktop.evaluate(()=>localStorage.getItem('rumbo-history-test-sentinel')),'HISTORIAL_INTACTO');
  await desktop.reload();
  await desktop.locator('#er-connect').waitFor();
  await desktop.locator('#er-pass').fill(password);
  await desktop.locator('#er-connect').click();
  await desktop.locator('#er-body tr').waitFor();
  assert.match(await desktop.locator('#er-body').innerText(),/Situación de prueba privada/);
  const mobile=await openPage({width:390,height:844});
  await mobile.locator('#er-pass').fill(password);
  await mobile.locator('#er-connect').click();
  await mobile.locator('#er-body tr').waitFor();
  assert.match(await mobile.locator('#er-body').innerText(),/Pausé diez segundos/);
  await mobile.locator('#er-body [data-er-delete]').click();
  await mobile.locator('#er-empty').waitFor({state:'visible'});
  assert.equal(storage.size,0);
  await desktop.locator('#er-refresh').click();
  await desktop.locator('#er-empty').waitFor({state:'visible'});
  assert.equal(await desktop.evaluate(()=>localStorage.getItem('rumbo-history-test-sentinel')),'HISTORIAL_INTACTO');
  await mobile.close();await desktop.close();
  process.stdout.write('PASS: cifrado, conexión, guardado, recarga, segundo navegador y borrado aislado.\\n');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
