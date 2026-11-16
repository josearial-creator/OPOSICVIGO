const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),headless:true,args:['--no-sandbox']});
 const storage=new Map(),password='clave privada larga de prueba 1234567890';
 let failNextReadStatus=null;
 const base='http://127.0.0.1:8086';
 async function openPage(viewport){
  const page=await browser.newPage({viewport});
  page.on('dialog',d=>d.accept());
  // Intento de cambiar el backend desde localStorage: Entrenamiento debe ignorarlo.
  await page.addInitScript(()=>{try{localStorage.setItem('rumbo-ai-endpoint','https://redirected.invalid');}catch{}});
  await page.route('https://redirected.invalid/training**',route=>route.fulfill({status:418,json:{error:'Destino externo inseguro'}}));
  await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({json:[]}));
  await page.route('https://rumbo-entrenador.jose-arial.workers.dev/training**',async route=>{
   const request=route.request(),method=request.method(),path=new URL(request.url()).pathname;
   const headers={'access-control-allow-origin':base,'access-control-allow-headers':'Authorization, Content-Type','access-control-allow-methods':'GET,POST,DELETE,OPTIONS'};
   if(method==='OPTIONS')return route.fulfill({status:204,headers,body:''});
   if(request.headers().authorization!=='Rumbo '+Buffer.from(password).toString('base64'))return route.fulfill({status:401,headers,json:{error:'Acceso no autorizado'}});
   if(method==='GET'){
    if(failNextReadStatus){const status=failNextReadStatus;failNextReadStatus=null;return route.fulfill({status,headers,json:{error:'Lectura temporalmente no disponible'}});}
    return route.fulfill({status:200,headers,json:{records:[...storage.values()]}});
   }
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
  // La nueva interfaz convive con el archivo de prácticas anteriores sin borrarlo.
  assert.equal(await desktop.locator('#er-rutinas-abcd').count(),0); // ID real: ev-rutinas-abcd
  assert.equal(await desktop.locator('#ev-rutinas-abcd').count(),1);
  assert.equal(await desktop.locator('#er-archive #ps-app').count(),1);
  assert.equal(await desktop.locator('#er-archive').evaluate(el=>el.open),false,'Las prácticas anteriores quedan plegadas');
  await desktop.locator('#er-archive > summary').click();
  assert.equal(await desktop.locator('#ps-pause-plus').isVisible(),true,'El archivo de prácticas anteriores sigue disponible');
  await desktop.locator('#er-archive > summary').click();
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
  assert.equal(await mobile.evaluate(()=>Object.values(localStorage).some(v=>v.includes('Situación de prueba privada'))),false,'No guardar los campos personales en localStorage');
  await mobile.locator('#er-lock').click();
  assert.equal(await mobile.locator('#er-private').isVisible(),false);
  assert.equal(await mobile.locator('#er-form [name=situacion]').inputValue(),'');
  await mobile.locator('#er-pass').fill(password);
  await mobile.locator('#er-connect').click();
  await mobile.locator('#er-body tr').waitFor();

  await mobile.locator('#er-body [data-er-delete]').click();
  await mobile.locator('#er-empty').waitFor({state:'visible'});
  assert.equal(storage.size,0);
  await desktop.locator('#er-refresh').click();
  await desktop.locator('#er-empty').waitFor({state:'visible'});
  assert.equal(await desktop.evaluate(()=>localStorage.getItem('rumbo-history-test-sentinel')),'HISTORIAL_INTACTO');

  // Una escritura confirmada por POST NO debe repetirse si el GET posterior recibe 503 o 410.
  for(const transientStatus of [503,410]){
   for(const [key,value]of Object.entries(values))await desktop.locator('#er-form [name='+key+']').fill(value+' (sin duplicar '+transientStatus+')');
   failNextReadStatus=transientStatus;
   await desktop.locator('#er-save').click();
   await desktop.waitForFunction(()=>document.querySelector('#er-status')?.textContent.includes('Guardado cifrado confirmado en Cloudflare, pero no se pudo actualizar'));
   assert.equal(storage.size,1,'El registro fue guardado una sola vez tras HTTP '+transientStatus);
   assert.equal(await desktop.locator('#er-form [name=situacion]').inputValue(),'','No retener formulario ya guardado');
   await desktop.locator('#er-refresh').click();
   await desktop.locator('#er-body tr').waitFor();
   assert.equal(await desktop.locator('#er-body tr').count(),1,'Recuperación del registro confirmado sin duplicación');
   await desktop.locator('#er-body [data-er-delete]').click();
   await desktop.locator('#er-empty').waitFor({state:'visible'});
   assert.equal(storage.size,0);
  }
  // Convivencia realista: las prácticas cifradas y ABCD ocupan el mismo endpoint,
  // pero cada interfaz solo debe mostrar el tipo que le corresponde.
  await desktop.locator('#er-archive > summary').click();
  await desktop.locator('#ps-steps-plus').click();
  await desktop.locator('#ps-password').fill(password);
  await desktop.locator('#ps-sync').click();
  await desktop.waitForFunction(()=>document.querySelector('#ps-sync-status')?.textContent.includes('Sincronización confirmada'));
  assert.equal(storage.size,1,'La práctica antigua sincronizada se conserva sin ABCD');
  await desktop.locator('#er-refresh').click();
  await desktop.waitForFunction(()=>document.querySelector('#er-status')?.textContent.includes('Registros recuperados'));
  assert.equal(await desktop.locator('#er-body tr').count(),0,'No presentar prácticas como ABCD');

  for(const [key,value]of Object.entries(values))await desktop.locator('#er-form [name='+key+']').fill(value+' mezclado');
  await desktop.locator('#er-save').click();
  await desktop.waitForFunction(()=>document.querySelector('#er-status')?.textContent.includes('Guardado cifrado confirmado'));
  assert.equal(storage.size,2,'Práctica antigua y ABCD comparten backend sin sobrescribirse');
  assert.equal(await desktop.locator('#er-body tr').count(),1,'La tabla solo muestra ABCD');

  const mixedMobile=await openPage({width:390,height:844});
  await mixedMobile.locator('#er-pass').fill(password);
  await mixedMobile.locator('#er-connect').click();
  await mixedMobile.locator('#er-body tr').waitFor({state:'visible'});
  assert.equal(await mixedMobile.locator('#er-body tr').count(),1);
  await mixedMobile.locator('#er-archive > summary').click();
  await mixedMobile.locator('#ps-password').fill(password);
  await mixedMobile.locator('#ps-sync').click();
  await mixedMobile.waitForFunction(()=>document.querySelector('#ps-sync-status')?.textContent.includes('Sincronización confirmada'));
  assert.match(await mixedMobile.locator('#ps-events').innerText(),/Detener, escuchar, pensar, procesar y actuar/,'La práctica se recupera sin convertir el ABCD');
  assert.equal(await mixedMobile.locator('#er-body tr').count(),1,'El ABCD no se transforma en práctica');
  await mixedMobile.locator('#er-body [data-er-delete]').click();
  await mixedMobile.locator('#er-empty').waitFor({state:'visible'});
  assert.equal(storage.size,1,'Eliminar ABCD no borra la práctica');
  await mixedMobile.close();
  storage.clear(); // limpieza exclusivamente del simulador de pruebas
  await mobile.close();await desktop.close();
  process.stdout.write('PASS: cifrado, conexión, guardado, recarga, segundo navegador y borrado aislado.\\n');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
