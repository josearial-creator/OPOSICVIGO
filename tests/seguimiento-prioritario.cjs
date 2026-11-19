const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const now=new Date(),date=delta=>{const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+delta);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const records=[
 {convocatoria_id:'followup-open',anio:2026,organismo:'Xunta de Galicia',puesto:'Auxiliar C2 · prueba de plazo',grupo:'C2',plazas:10,discapacidad_general:1,inscripcion:'Abierta',estado:'En fase de presentación de solicitudes',inicio:date(-3),fin:date(1),prioridad:'Alta',fuente:'https://www.xunta.gal/'},
 {convocatoria_id:'followup-oep',anio:2026,organismo:'Xunta de Galicia',puesto:'Administrativo C1 · oferta OEP',grupo:'C1',plazas:55,discapacidad_general:5,inscripcion:'No convocada',estado:'OEP 2026 aprobada · pendiente de convocatoria individual',prioridad:'Alta',fuente:'https://www.xunta.gal/'},
 {convocatoria_id:'followup-unknown',anio:2026,organismo:'Concello de Vigo',puesto:'Otro proceso en revisión',grupo:'C2',plazas:2,inscripcion:'Por verificar',estado:'Plazo por verificar',prioridad:'Media',fuente:'https://sede.vigo.org/'}
];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
 try{
  for(const width of [390,1120]){
   const context=await browser.newContext({viewport:{width,height:840},serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({json:records}));
   await page.goto('http://127.0.0.1:8086/#convocatorias');
   await page.locator('#rows tr').first().waitFor();
   assert.match(await page.locator('#my-followup-caption').innerText(),/Marca ☆/);
   const openRow=page.locator('#rows tr').filter({hasText:'Auxiliar C2 · prueba de plazo'});
   await openRow.locator('button[aria-label="Alternar favorito"]').click();
   await page.locator('#my-followup-list .my-followup-item').first().getByText(/mañana/).waitFor();
   assert.equal(await page.locator('#my-followup-list .my-followup-item').count(),1);
   await page.locator('#status-filter').selectOption('convocatoria_pendiente');
   const oepRow=page.locator('#rows tr').filter({hasText:'Administrativo C1 · oferta OEP'});
   await oepRow.locator('button[aria-label="Alternar favorito"]').click();
   assert.equal(await page.locator('#my-followup-list .my-followup-item').count(),2);
   assert.match(await page.locator('#my-followup-list .my-followup-item').first().innerText(),/Auxiliar C2/,'La inscripción con plazo próximo es prioritaria');
   assert.match(await page.locator('#my-followup-list .my-followup-item').nth(1).innerText(),/falta la convocatoria individual/);
   await page.locator('#my-followup-all').click();
   assert.equal(await page.locator('#only-favs').isChecked(),true);
   assert.equal(await page.locator('#status-filter').inputValue(),'');
   assert.equal(await page.locator('#rows tr').count(),2);
   await page.locator('#my-followup-list .my-followup-item').first().getByRole('button',{name:'Ver ficha'}).click();
   await page.locator('#detail-dialog').waitFor({state:'visible'});
   await page.locator('#dialog-close').click();
   await page.reload();
   await page.locator('#my-followup-list .my-followup-item').first().waitFor();
   assert.equal(await page.locator('#my-followup-list .my-followup-item').count(),2,'Favoritos persisten al recargar');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),true,'No desbordamiento móvil');
   assert.deepEqual(errors,[],'Sin errores JS');
   await context.close();
  }
  console.log('PASS: seguimiento de favoritas, plazos válidos, próxima acción, filtros y móvil.');
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1);});
