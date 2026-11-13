const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),headless:true,args:['--no-sandbox']});
 try {
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const historical=Array.from({length:131},(_,i)=>({puesto:'Histórica '+i,organismo:'Vigo',plazas:1,inscripcion:'Abierta',estado:'En fase de presentación de solicitudes',fin:'31/12/2099',fuente:'https://example.org/listado'}));
 historical[0].convocatoria_id='exp-0';
 const legacy=r=>[r.organismo,r.puesto,r.grupo,r.tipo,r.plazas,r.discapacidad].map(v=>String(v??'').trim().toLocaleLowerCase('es').replace(/\s+/g,' ')).join('¦');
 const seed={records:historical,favorites:[legacy(historical[0]),legacy(historical[1])],notes:{[legacy(historical[0])]:'Nota coincidente',[legacy(historical[1])]:'Nota histórica'},previousKeys:[],lastSuccess:null};
 let feed=[{...historical[0],plazas:5,inscripcion:'Cerrada',estado:'Inscripción cerrada'},{puesto:'Nueva',organismo:'Vigo'}];
 let mode='ok';
 await page.route('https://raw.githubusercontent.com/**',r=>mode==='offline'?r.abort():mode==='invalid'?r.fulfill({body:'{'}):r.fulfill({json:feed}));
 await page.addInitScript(seed=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('rumbo-replica-v1',JSON.stringify(seed));sessionStorage.setItem('seeded','1');}},seed);
 const snapshot=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('rumbo-replica-v1')));
 const refresh=async()=>{await page.locator('#refresh').click();await page.waitForFunction(()=>!document.getElementById('refresh').disabled);};
 await page.goto('http://127.0.0.1:8086');await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
 let data=await snapshot();assert.equal(data.records.length,132);assert.equal(data.favorites.length,2);assert.deepEqual(Object.values(data.notes).sort(),['Nota coincidente','Nota histórica']);
 assert.equal(data.records.find(r=>r.convocatoria_id==='exp-0').plazas,5);
 const before=data;await refresh();await page.reload();await page.waitForFunction(()=>!document.getElementById('refresh').disabled);data=await snapshot();delete before.lastSuccess;delete data.lastSuccess;assert.deepEqual(data,before);
 // Missing cards cannot advertise their historical application period as currently open.
 await page.locator('#rows tr').filter({has:page.getByText('Histórica 1',{exact:true})}).getByRole('button',{name:'Detalle',exact:true}).click();
 assert.match(await page.locator('#dialog-content').innerText(),/Por verificar · ausente/);assert.match(await page.locator('#dialog-content').innerText(),/Histórico, por verificar/);assert.doesNotMatch(await page.locator('#dialog-content').innerText(),/En fase de presentación/);await page.locator('#dialog-done').click();
 // Reappearance retains both personal associations.
 feed=[historical[0],historical[1]];await refresh();data=await snapshot();assert.equal(data.records.length,132);assert.equal(data.records.find(r=>r.puesto==='Histórica 1')._rumboFeedMissing,false);assert.equal(data.favorites.length,2);assert.equal(Object.keys(data.notes).length,2);
 // Distinct editions/URLs must not collide; uncertain changes remain separate.
 feed=[{puesto:'Auxiliar',organismo:'Vigo',plazas:1,fin:'2026-01-01',fuente:'https://example.org/2026'}];await refresh();
 feed=[{...feed[0],fin:'2027-01-01',fuente:'https://example.org/2027'}];await refresh();data=await snapshot();assert.equal(data.records.filter(r=>r.puesto==='Auxiliar').length,2);
 feed=[{...historical[1],plazas:9}];await refresh();data=await snapshot();assert.equal(data.records.filter(r=>r.puesto==='Histórica 1').length,2);assert.equal(data.favorites.length,2);assert.equal(Object.keys(data.notes).length,2);
 // Empty/malformed/offline feeds never write over the cache.
 const intact=await page.evaluate(()=>localStorage.getItem('rumbo-replica-v1'));
 for(const value of ['empty','invalid','offline']){mode=value==='empty'?'ok':value;feed=[];await refresh();assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-replica-v1')),intact);}
 mode='ok';feed=[{puesto:'Otra nueva',organismo:'Vigo'}];
 // Quota failure is visible and leaves the persisted snapshot untouched.
 await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='rumbo-replica-v1')throw new DOMException('Full','QuotaExceededError');return window.originalSetItem.call(this,k,v);};});
 await refresh();assert.match(await page.locator('#status').innerText(),/no se pudo guardar/);assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-replica-v1')),intact);
 await page.evaluate(()=>Storage.prototype.setItem=window.originalSetItem);
 // A stale tab cannot overwrite a note written by another tab.
 const second=await context.newPage();await second.route('https://raw.githubusercontent.com/**',r=>r.abort());await second.goto('http://127.0.0.1:8086');await second.evaluate(()=>{const d=JSON.parse(localStorage.getItem('rumbo-replica-v1'));d.notes.external='Nota de otra pestaña';localStorage.setItem('rumbo-replica-v1',JSON.stringify(d));});
 await refresh();assert.equal((await snapshot()).notes.external,'Nota de otra pestaña');assert.match(await page.locator('#status').innerText(),/no se pudo guardar/);await second.close();
 assert.deepEqual(errors,[]);
 await context.close();
 // Invalid caches are preserved, rather than silently replaced by a successful fetch.
 const bad=await browser.newPage({serviceWorkers:'block'});
 await bad.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[{puesto:'Remota'}]}));
 await bad.addInitScript(()=>localStorage.setItem('rumbo-replica-v1','{broken'));
 await bad.goto('http://127.0.0.1:8086');assert.equal(await bad.evaluate(()=>localStorage.getItem('rumbo-replica-v1')),'{broken');assert.match(await bad.locator('#status').innerText(),/Se conserva intacta/);await bad.close();
 console.log('PASS conservación: migración, 131 fichas, identidad oficial, ediciones, notas, favoritos, recarga, historial, reaparición, feed inválido, cuota, pestañas y copia dañada.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
