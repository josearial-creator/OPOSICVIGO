const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const path=require('node:path');
const all=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../docs/importar_rumbo.json'),'utf8'));
const xunta=all.filter(r=>r.organismo==='Xunta de Galicia');
assert.equal(xunta.length,4);
assert.equal(xunta.filter(r=>r.inscripcion==='No convocada').length,2);
assert.equal(xunta.filter(r=>r.inscripcion==='Abierta').length,2);
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
 try{
  for(const width of [390,1120]){
   const context=await browser.newContext({viewport:{width,height:840},serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({json:all}));
   await page.goto('http://127.0.0.1:8086/#convocatorias');
   const panel=page.locator('#convocatorias');
   await page.locator('#source option[value="Xunta de Galicia"]').waitFor({state:'attached'});
   assert.equal(await panel.locator('#xunta-no-convocada').count(),1,'Los filtros deben estar dentro de Convocatorias');
   await panel.locator('#xunta-no-convocada').click();
   assert.equal(await page.locator('#source').inputValue(),'Xunta de Galicia');
   assert.equal(await page.locator('#status-filter').inputValue(),'convocatoria_pendiente');
   assert.equal(await panel.locator('#rows tr').count(),2,'Las OEP sin convocatoria son dos');
   await panel.locator('#rows tr').first().locator('.icon-button').click();
   assert.equal(await page.locator('#count-favs').innerText(),'1','Favorito queda guardado');
   await panel.locator('#xunta-guardadas').click();
   assert.equal(await panel.locator('#rows tr').count(),1,'Mis guardadas conserva el filtro Xunta');
   await page.reload();
   await page.locator('#xunta-guardadas').click();
   assert.equal(await panel.locator('#rows tr').count(),1,'Favorito persiste tras recarga');
   await panel.locator('#rows tr').first().getByRole('button',{name:'Detalle'}).click();
   await page.locator('#dialog-content').getByText(/OEP 2026/).first().waitFor();
   await page.locator('#dialog-close').click();
   await panel.locator('#xunta-abiertas').click();
   const now=Date.now(),opened=xunta.filter(r=>now>=Date.parse(r.inicio)&&now<=Date.parse(r.fin)+86400000).length;
   assert.equal(await panel.locator('#rows tr').count(),opened,'El filtro abierto respeta las fechas');
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('PASS: Xunta en Convocatorias, estados, favoritos persistentes, detalle y móvil.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
