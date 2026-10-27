const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),headless:true,args:['--no-sandbox']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({json:[{puesto:'Auxiliar de prueba',organismo:'Concello de Vigo',plazas:2,grupo:'C2',estado:'Convocada'}]}));
await page.goto('http://127.0.0.1:8086');await page.locator('#rows button').first().waitFor();
await page.getByRole('button',{name:'Alternar favorito'}).click();
await page.getByRole('button',{name:'Detalle',exact:true}).click();await page.locator('#dialog-content textarea').fill('Nota original conservada');await page.locator('#dialog-done').click();

// Simulate unavailable storage after the form is filled: no false success or duplicates.
async function blockEvolutionStorage(){
 await page.evaluate(()=>{window.restoreEvolutionStorage=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='rumbo-evolucion-v1')throw new DOMException('Storage full','QuotaExceededError');return window.restoreEvolutionStorage.call(this,key,value);};});
}
async function restoreEvolutionStorage(){await page.evaluate(()=>{Storage.prototype.setItem=window.restoreEvolutionStorage;delete window.restoreEvolutionStorage;});}

const original=await page.evaluate(()=>localStorage.getItem('rumbo-replica-v1'));
assert.equal(await page.locator('.ev-history').count(),3);
assert.match(await page.locator('#mi-evolucion').innerText(),/Modo manual por defecto/);
await page.locator('#ev-start [name=skill]').selectOption('1');await page.locator('#ev-start button').click();
await page.locator('[name="before-nerviosismo"]').fill('7');await page.locator('#ev-exercise button.primary').click();
await page.locator('#ev-exercise [name=response]').fill('Entiendo que hay errores. ¿Puedes darme un ejemplo? Hagamos una pausa y revisémoslo.');
await page.reload();assert.match(await page.locator('#ev-exercise [name=response]').inputValue(),/Entiendo/);
await page.locator('#ev-exercise button.primary').click();
await page.locator('[name="after-nerviosismo"]').fill('7');
await page.locator('[name=criterion0]').selectOption('3');await page.locator('[name=criterion1]').selectOption('4');
for(const [name,value]of Object.entries({positive:'Pedí un ejemplo concreto',improve:'Resumir antes de preguntar',alternative:'Entiendo que te preocupa la calidad. ¿Qué error revisamos primero?',practice:'Escuchar y resumir antes de proponer'}))await page.locator(`#ev-exercise [name=${name}]`).fill(value);
const beforeFailedEvaluation=await page.evaluate(()=>localStorage.getItem('rumbo-evolucion-v1'));
await blockEvolutionStorage();
for(let attempt=0;attempt<2;attempt++){
 await page.locator('#ev-exercise button.primary').click();
 assert.match(await page.locator('#ev-message').innerText(),/No se pudo guardar/);
 assert.equal(await page.getByText('Evaluación registrada:',{exact:false}).count(),0);
 assert.equal(await page.locator('[name=positive]').inputValue(),'Pedí un ejemplo concreto');
 assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-evolucion-v1')),beforeFailedEvaluation);
}
const recoveryDownload=page.waitForEvent('download');await page.locator('#ev-export').click();
const recovery=JSON.parse(await require('node:fs/promises').readFile(await (await recoveryDownload).path(),'utf8'));
assert.equal(recovery.draft.step,'review');assert.equal(recovery.draft.exercises.length,0);
assert.equal(recovery.draft.form.positive,'Pedí un ejemplo concreto');
await restoreEvolutionStorage();
await page.locator('#ev-exercise button.primary').click();assert.match(await page.locator('#ev-coach').innerText(),/87.5\/100/);
await page.addInitScript(()=>{let d;try{d=JSON.parse(localStorage.getItem('rumbo-evolucion-v1')||'null')}catch{return;}if(d?.draft){d.draft.seconds=610;localStorage.setItem('rumbo-evolucion-v1',JSON.stringify(d));}});await page.reload();
const beforeFailedEnd=await page.evaluate(()=>localStorage.getItem('rumbo-evolucion-v1'));
await blockEvolutionStorage();
for(let attempt=0;attempt<2;attempt++){
 await page.locator('#ev-end').click();
 assert.match(await page.locator('#ev-message').innerText(),/No se pudo guardar/);
 assert.equal(await page.locator('#ev-end').count(),1);
 assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-evolucion-v1')),beforeFailedEnd);
}
await restoreEvolutionStorage();await page.locator('#ev-end').click();await page.reload();
let data=await page.evaluate(()=>JSON.parse(localStorage.getItem('rumbo-evolucion-v1')));
assert.equal(data.sessions.length,2);assert.equal(data.sessions[1].completed,true);assert.equal(data.sessions[1].exercises[0].skills[1],87.5);assert.equal(data.sessions[1].exercises[0].before.nerviosismo,7);assert.equal(data.sessions[1].exercises[0].after.nerviosismo,7);
const current=JSON.parse(await page.evaluate(()=>localStorage.getItem('rumbo-replica-v1'))), prior=JSON.parse(original);delete current.lastSuccess;delete prior.lastSuccess;assert.deepEqual(current,prior);
await page.locator('#ev-real-form [name=context]').fill('<img src=x onerror=alert(1)>');for(const name of ['response','felt','improve'])await page.locator(`#ev-real-form [name=${name}]`).fill('Registro personal');await page.locator('#ev-real-form button').click();assert.equal(await page.locator('#mi-evolucion img').count(),0);
await page.locator('#ev-goal-form input').fill('Practicar dos semanas');await page.locator('#ev-goal-form button').click();await page.locator('[data-goal]').last().check();await page.reload();assert.equal(await page.locator('[data-goal]').last().isChecked(),true);
// Six distinct sessions are required for trends; scores do not depend on emotions.
await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('rumbo-evolucion-v1'));const template=d.sessions[1];for(let i=0;i<5;i++)d.sessions.push({...template,id:'test-'+i,date:new Date(2026,9,18+i).toISOString(),exercises:[{...template.exercises[0],skills:{1:i<2?65:90}}]});localStorage.setItem('rumbo-evolucion-v1',JSON.stringify(d));});await page.reload();assert.match(await page.locator('#mi-evolucion').innerText(),/Últimas 3 frente a 3 anteriores/);
await page.locator('#ev-period').selectOption('week');assert.match(await page.locator('#mi-evolucion').innerText(),/semanales/);
const download=page.waitForEvent('download');await page.locator('#ev-export').click();assert.equal((await download).suggestedFilename(),'rumbo-mi-evolucion.json');
await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.ev-mobile-link').isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
const snapshot=await page.evaluate(()=>localStorage.getItem('rumbo-evolucion-v1'));
await page.locator('#ev-import').setInputFiles({name:'copia.json',mimeType:'application/json',buffer:Buffer.from(snapshot)});
await page.getByText('Copia incorporada sin reemplazar', {exact:false}).waitFor();
assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('rumbo-evolucion-v1')))).sessions.length,7);
await page.locator('#ev-import').setInputFiles({name:'invalido.json',mimeType:'application/json',buffer:Buffer.from('{"version":1}')});
await page.getByText('No se pudo restaurar:', {exact:false}).waitFor();
assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-evolucion-v1')),snapshot);
await page.setViewportSize({width:1440,height:1000});await page.locator('#mi-evolucion').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/mi-evolucion-github.png'});
await page.evaluate(()=>localStorage.setItem('rumbo-evolucion-v1','invalid json'));await page.reload();assert.match(await page.locator('#ev-message').innerText(),/No se pudo leer/);assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-evolucion-v1')),'invalid json');
assert.deepEqual(errors,[]);await browser.close();console.log('PASS: simulación, rúbrica, emociones, borrador, historial, tendencias, exportación, objetivos, situaciones, móvil y conservación de favoritos/notas.');
})().catch(e=>{console.error(e);process.exit(1)});
