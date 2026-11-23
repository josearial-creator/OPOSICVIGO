const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const records=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/importar_rumbo.json'),'utf8'));
const aeat=records.filter(r=>r.id==='aeat-oep-2026-agentes-1135h');
assert.equal(aeat.length,1,'Solo una ficha por oferta de Hacienda 2026');
assert.equal(aeat[0].grupo,'C1','Agentes de Hacienda no es C2');
assert.equal(aeat[0].plazas,1000);
assert.equal(aeat[0].discapacidad_general,80);
assert.equal(aeat[0].inscripcion,'No convocada','La oferta no abre un plazo');
assert.equal(Boolean(aeat[0].inicio||aeat[0].fin),false,'No inventar fechas');
assert.match(aeat[0].fuente,/^https:\/\/www\.boe\.es\//);
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),headless:true,args:['--no-sandbox']});
 try{
  for(const width of [390,1120]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({json:[
    {puesto:'Auxiliar sintético',organismo:'Organismo de prueba',grupo:'C2',plazas:1,inscripcion:'Por verificar'},
    aeat[0]
   ]}));
   await page.goto('http://127.0.0.1:8086/#convocatorias');
   await page.locator('#rows tr').first().waitFor({state:'attached'});
   await page.locator('#aeat-c1').click();
   assert.equal(await page.locator('#source').inputValue(),'Agencia Tributaria (AEAT)');
   assert.equal(await page.locator('#search').inputValue(),'Agentes de la Hacienda Pública');
   assert.equal(await page.locator('#rows tr').count(),1,'Filtro AEAT C1 no muestra otras plazas');
   const row=page.locator('#rows tr').first();
   assert.match(await row.innerText(),/AGENTES DE LA HACIENDA PÚBLICA/);
   assert.match(await row.innerText(),/Pendiente de convocatoria/);
   assert.doesNotMatch(await row.innerText(),/Inscripción abierta/);
   await row.getByRole('button',{name:'Alternar favorito'}).click();
   assert.equal(await page.locator('#count-favs').innerText(),'1');
   await page.locator('#clear').click();
   assert.equal(await page.locator('#rows tr').count(),2,'Limpiar recupera todas las convocatorias');
   assert.equal(await page.locator('.aeat-shortcuts a[href*="BOE-A-2026-9946"]').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('PASS: AEAT C1 OEP 2026, reserva discapacidad, filtro y favoritos; C2 sin convocatoria ficticia.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
