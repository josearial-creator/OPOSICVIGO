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
  assert.equal(await page.locator('#routine-cancel').isVisible(),false);
  await page.locator('#routine-start').click();
  assert.equal(await page.locator('#routine-start').isVisible(),false,'No se puede reiniciar una pausa en curso');
  assert.equal(await page.locator('#routine-stay').isVisible(),false,'No permite confirmar antes de 10 segundos');
  await page.waitForTimeout(10500);
  await page.locator('#routine-stay').click();
  assert.match(await page.locator('#routine-count').innerText(),/1/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-historial-importado-v1')),privateFixture,'Nunca modifica el historial');
  await page.reload();
  assert.equal(await page.locator('input[data-routine="planificar"]').isChecked(),true,'Rutina persistente');
  assert.match(await page.locator('#routine-count').innerText(),/1/,'Pausa persistente');
  // El reloj civil cambia, pero la pausa exige diez segundos transcurridos.
  await page.clock.setFixedTime(new Date('2026-11-14T12:00:00'));
  await page.locator('#routine-start').click();
  await page.clock.setFixedTime(new Date('2026-11-14T13:00:00'));
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#routine-stay').isVisible(),false,'Adelantar el reloj no completa la pausa');
  await page.locator('#routine-cancel').click();
  // Cambio de día en la misma pestaña: el render no puede alterar el historial.
  await page.clock.setFixedTime(new Date('2026-11-14T23:59:59'));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.locator('input[data-routine="planificar"]').check();
  const beforeMidnight=await page.evaluate(()=>localStorage.getItem('rumbo-rutinas-hoy-v1'));
  await page.clock.setFixedTime(new Date('2026-11-15T00:00:01'));
  await page.waitForTimeout(1100);
  assert.equal(await check.isChecked(),false,'La nueva jornada se muestra sin marcas antiguas');
  assert.match(await page.locator('#routine-count').innerText(),/0/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-rutinas-hoy-v1')),beforeMidnight,'Actualizar el día no escribe ni borra registros');
  await check.check();
  const afterMidnight=await page.evaluate(()=>JSON.parse(localStorage.getItem('rumbo-rutinas-hoy-v1')));
  assert.deepEqual(afterMidnight.days['2026-11-14'],JSON.parse(beforeMidnight).days['2026-11-14']);
  assert.deepEqual(afterMidnight.days['2026-11-15'].routines,['planificar']);
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