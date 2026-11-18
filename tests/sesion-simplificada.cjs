const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
 try {
  const page=await browser.newPage();
  const secret='contraseña-ficticia-de-prueba-123456789';
  const unauthorized='contraseña-equivocada';
  await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[]}));
  await page.route('https://rumbo-entrenador.jose-arial.workers.dev/notes**',route=>{
   const credential=route.request().headers().authorization||'';
   const expected='Rumbo '+Buffer.from(secret).toString('base64');
   return route.fulfill({status:credential===expected?200:401,headers:{'access-control-allow-origin':'*'},json:credential===expected?{notes:[]}:{error:'Acceso denegado'}});
  });
  await page.goto('http://127.0.0.1:8086/#mi-espacio');
  assert.equal(await page.evaluate(()=>window.RumboSession.available()),false);
  await page.evaluate(()=>{
   const box=document.createElement('div');box.id='test-session-ai';document.body.append(box);
   window.RumboAI.mount(box,null,[],'');
  });
  await page.locator('#test-session-ai details summary').click();
  const reuse=page.locator('#test-session-ai button').filter({hasText:'Usar sesión de Mi espacio'});
  assert.equal(await reuse.isDisabled(),true,'La IA no puede reutilizar una sesión no validada');
  await page.locator('#esp-password').fill(unauthorized);
  await page.locator('#esp-connect').click();
  await page.getByText('Acceso denegado',{exact:false}).waitFor();
  assert.equal(await page.evaluate(()=>window.RumboSession.available()),false,'Un fallo de autorización no crea sesión');
  await page.locator('#esp-password').fill(secret);
  await page.locator('#esp-connect').click();
  await page.locator('#esp-private').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.RumboSession.available()),true);
  assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('contraseña-ficticia')),false);
  assert.equal(await reuse.isDisabled(),false);
  await reuse.click();
  const ai=page.locator('#test-session-ai');
  assert.equal(await ai.locator('input[type=password]').inputValue(),secret);
  assert.equal(await ai.locator('input[type=checkbox]').first().isChecked(),false,'Reutilizar la sesión no da consentimiento a Gemini');
  await page.evaluate(()=>window.RumboSession.lock());
  assert.equal(await page.evaluate(()=>window.RumboSession.available()),false);
  assert.equal(await ai.locator('input[type=password]').inputValue(),'','Al cerrar sesión se limpia el acceso de IA');
  assert.equal(await reuse.isDisabled(),true);
  await page.locator('#esp-private').waitFor({state:'hidden'});
  assert.equal(await page.locator('#esp-private').isVisible(),false);
  assert.equal(await page.evaluate(()=>window.RumboSession.available()),false);
  await page.reload();
  assert.equal(await page.evaluate(()=>window.RumboSession.available()),false,'La credencial nunca sobrevive a recargas');
  console.log('PASS: sesión en memoria, cierre y recarga sin credenciales almacenadas.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
