const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({json:[
{puesto:'Administrativa/o',organismo:'Concello de Vigo',plazas:2,grupo:'C1',tipo:'Turno libre',estado:'En fase de presentación de solicitudes',inscripcion:'Abierta',fin:'31/12/2099',fuente:'https://sede.vigo.org'},
{puesto:'Auxiliar',organismo:'SERGAS',plazas:5,grupo:'C2',tipo:'Turno libre',estado:'Plazo por verificar',inscripcion:'Por verificar',fin:'31/02/2026',fuente:'https://sergas.es'}
]}));
await page.goto('http://127.0.0.1:8086');
await page.locator('#rows tr').first().waitFor();
assert.match(await page.locator('#today-actions').innerText(),/Marca con ☆/);
await page.locator('#rows tr').filter({hasText:'Administrativa/o'}).getByRole('button',{name:'Alternar favorito'}).click();
assert.match(await page.locator('#today-metrics').innerText(),/Favoritas abiertas según fuente/);
assert.equal(await page.locator('#today-metrics .today-metric strong').first().innerText(),'1');
await page.locator('#today-actions').getByRole('button',{name:'Ver ficha'}).click();
assert.match(await page.locator('#detail-dialog').innerText(),/Administrativa\/o/);
await page.locator('#dialog-done').click();
await page.locator('#ev-quick-form textarea').fill('Una situación concreta para recordar.');
await page.locator('#ev-quick-form button').click();
const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('rumbo-evolucion-v1')));
assert.equal(data.real.at(-1).context,'Una situación concreta para recordar.');
assert.equal(data.real.at(-1).felt,'');
await page.reload();
assert.equal(await page.locator('#today-metrics .today-metric strong').first().innerText(),'1');
assert.match(await page.locator('#ev-diary').innerText(),/Una situación concreta/);
assert.equal(await page.locator('[data-week-value="notes"]').innerText(),'1');
assert.equal(await page.locator('[data-week-value="sessions"]').innerText(),'0');
await page.evaluate(()=>{
  const d=JSON.parse(localStorage.getItem('rumbo-evolucion-v1'));
  const today=new Date(),monday=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
  const before=new Date(monday);before.setDate(before.getDate()-3);
  d.sessions.push({id:'semanal-test',date:today.toISOString(),seconds:600,completed:true,source:'manual',exercises:[{
    id:'e-semanal',title:'Simulación de prueba',score:75,skills:{1:75},
    before:{nerviosismo:7},after:{nerviosismo:6}
  }]});
  d.sessions.push({id:'semanal-previo',date:before.toISOString(),seconds:600,completed:true,source:'manual',exercises:[]});
  d.real.push({id:'nota-anterior',date:before.toISOString(),context:'Semana anterior',response:'',felt:'',improve:''});
  localStorage.setItem('rumbo-evolucion-v1',JSON.stringify(d));
});
await page.reload();
assert.equal(await page.locator('[data-week-value="sessions"]').innerText(),'1');
assert.equal(await page.locator('[data-week-value="exercises"]').innerText(),'1');
assert.equal(await page.locator('[data-week-value="notes"]').innerText(),'1');
assert.match(await page.locator('#ev-week-skill').innerText(),/Escucha activa/);
assert.match(await page.locator('#ev-week-compare').innerText(),/1 sesión y 1 apunte/);
assert.match(await page.locator('#ev-week-nervous').innerText(),/7,0 → 6,0/);

assert.deepEqual(errors,[]);
await browser.close();
console.log('PASS: panel Hoy, ficha favorita, diario rápido y persistencia tras recarga.');
})().catch(e=>{console.error(e);process.exit(1)});