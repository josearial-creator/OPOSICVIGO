const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox'],headless:true});
try{
const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[{puesto:'Auxiliar',organismo:'Vigo',plazas:3,grupo:'C2',fin:'30/11/2026',inscripcion:'Por verificar'}]}));
await page.goto('http://127.0.0.1:8086/');
await page.locator('#rows tr').first().waitFor();
assert.equal(await page.locator('.mobile-tabbar a').count(),4);
assert.equal(await page.locator('#mi-dia').isVisible(),true);
await page.locator('[data-mobile-tab="oposiciones"]').click();
assert.equal(await page.locator('#convocatorias').isVisible(),true);
assert.equal(await page.locator('#mi-dia').isVisible(),false);
assert.equal(await page.locator('#rows tr').first().getAttribute('data-test')||'','');
assert.equal(await page.locator('#rows td[data-label="Fin del plazo"]').first().innerText(),'30/11/2026');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.locator('[data-mobile-tab="diario"]').click();assert.equal(await page.locator('#mi-evolucion').isVisible(),true);
await page.locator('[data-mobile-tab="mas"]').click();assert.equal(await page.locator('#copias-rumbo').isVisible(),true);
await page.locator('#backup-pass').fill('frase-muy-segura-123');
await page.locator('#backup-repeat').fill('frase-muy-segura-123');
const download=page.waitForEvent('download');await page.locator('#backup-export').click();
const file=await download;assert.match(file.suggestedFilename(),/rumbo-copia-cifrada/);
assert.equal(await page.locator('#backup-status').innerText(),'Copia cifrada creada. Guarda el archivo y la frase por separado.');
const manifest=await page.locator('link[rel=manifest]').getAttribute('href');assert.equal(manifest,'manifest.webmanifest');
const resp=await page.request.get('http://127.0.0.1:8086/sw.js');assert.equal(resp.status(),200);
assert.deepEqual(errors,[]);
console.log('PASS: navegación móvil, tarjetas, copias cifradas y archivos PWA.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});