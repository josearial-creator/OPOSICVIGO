const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH&&process.env.CHROMIUM_PATH!=='bundled'?process.env.CHROMIUM_PATH:undefined});
 try{
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
  await page.goto('http://127.0.0.1:8086/');
  await page.locator('#routine-start').waitFor();
  // Datos personales de prueba: nunca se suben a la web ni a GitHub.
  const privateFixture=JSON.stringify({version:1,entries:[{id:'quick:ficticio',kind:'quick',date:'2026-11-13',title:'Texto de prueba',payload:{text:'NO REAL'}}]});
  await page.evaluate(f=>localStorage.setItem('rumbo-historial-importado-v1',f),privateFixture);
  await page.reload();
  assert.match(await page.locator('#routine-focus').innerText(),/Elige una prioridad/);
  const check=page.locator('input[data-routine="planificar"]');
  await check.check();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('rumbo-rutinas-hoy-v1')).days[Object.keys(JSON.parse(localStorage.getItem('rumbo-rutinas-hoy-v1')).days)[0]].routines.includes('planificar')),true);
  await page.locator('#routine-start').click();
  assert.equal(await page.locator('#routine-stay').isVisible(),false,'No permite confirmar antes de 10 segundos');
  await page.waitForTimeout(10500);
  await page.locator('#routine-stay').click();
  assert.match(await page.locator('#routine-count').innerText(),/1/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-historial-importado-v1')),privateFixture,'Nunca modifica el historial');
  await page.reload();
  assert.equal(await page.locator('input[data-routine="planificar"]').isChecked(),true,'Rutina persistente');
  assert.match(await page.locator('#routine-count').innerText(),/1/,'Pausa persistente');
  const prev=await page.evaluate(()=>localStorage.getItem('rumbo-rutinas-hoy-v1'));
  // Una pestaña ajena modifica el registro; la abierta no debe pisarlo.
  await page.evaluate(()=>{const k='rumbo-rutinas-hoy-v1',v=JSON.parse(localStorage.getItem(k));v.external='otra pestaña';localStorage.setItem(k,JSON.stringify(v));});
  const remote=await page.evaluate(()=>localStorage.getItem('rumbo-rutinas-hoy-v1'));
  await page.locator('input[data-routine="estudiar"]').click();
  assert.equal(await page.locator('input[data-routine="estudiar"]').isChecked(),false,'Se revierte la marca cuando falla el guardado');
  assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-rutinas-hoy-v1')),remote,'El conflicto de pestañas no sobrescribe');
  assert.match(await page.locator('#routine-message').innerText(),/Otra pestaña/);
  await page.evaluate(()=>localStorage.setItem('rumbo-rutinas-hoy-v1','{incompatible'));
  await page.reload();
  assert.equal(await page.locator('#routine-start').isDisabled(),true,'Copia incompatible se bloquea');
  assert.equal(await page.locator('input[data-routine="planificar"]').isDisabled(),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-rutinas-hoy-v1')),'{incompatible','Nunca corrige borrando');
  assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-historial-importado-v1')),privateFixture);
  assert.deepEqual(errors,[]);
  assert(prev);
  console.log('PASS Hoy: rutinas, 10 s, persistencia, protección del historial, pestañas y copia incompatible.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});