const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
 try {
  const page=await browser.newPage();
  const secret='contraseña-ficticia-de-prueba-123456789';
  await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[]}));
  await page.route('https://rumbo-entrenador.jose-arial.workers.dev/notes**',route=>route.fulfill({headers:{'access-control-allow-origin':'*'},json:{notes:[]}}));
  await page.goto('http://127.0.0.1:8086/#mi-espacio');
  assert.equal(await page.evaluate(()=>window.RumboSession.available()),false);
  await page.locator('#esp-password').fill(secret);
  await page.locator('#esp-connect').click();
  await page.locator('#esp-private').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.RumboSession.available()),true);
  assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('contraseña-ficticia')),false);
  await page.evaluate(()=>window.RumboSession.lock());
  assert.equal(await page.evaluate(()=>window.RumboSession.available()),false);
  await page.locator('#esp-disconnect').click();
  assert.equal(await page.locator('#esp-private').isVisible(),false);
  assert.equal(await page.evaluate(()=>window.RumboSession.available()),false);
  await page.reload();
  assert.equal(await page.evaluate(()=>window.RumboSession.available()),false,'La credencial nunca sobrevive a recargas');
  console.log('PASS: sesión en memoria, cierre y recarga sin credenciales almacenadas.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
