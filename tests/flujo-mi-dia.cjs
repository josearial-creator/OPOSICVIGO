const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8086/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox'],headless:true});
 try{
  for(const width of [320,390,560,768,1120]){
   const context=await browser.newContext({viewport:{width,height:840},serviceWorkers:'block'});
   const page=await context.newPage(), errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[]}));
   await page.goto(base+'#mi-dia');
   await page.locator('#mi-dia').waitFor({state:'visible'});
   assert.equal(await page.locator('#assistant-now-card').count(),0,'No duplicar identificador de tarjeta');
   assert.equal(await page.locator('.assistant-now-card').isVisible(),true,'Mostrar tarea principal');
   assert.match(await page.locator('#assistant-now-task').innerText(),/Todavía no hay/);
   assert.equal(await page.locator('#assistant-focus-next').isDisabled(),true);
   assert.equal(await page.locator('#assistant-priority-details').evaluate(e=>e.open),false);
   assert.equal(await page.locator('#assistant-planning-details').evaluate(e=>e.open),false);
   assert.equal(await page.locator('#assistant-capture').isVisible(),true,'Captura disponible');
   assert.equal(await page.locator('#routine-start').isVisible(),true,'No ocultar el ejercicio de pausa');
   assert.equal(await page.locator('.routine-panel').evaluate(e=>!!e.previousElementSibling && e.previousElementSibling.classList.contains('assistant-body')),true,'Rutinas después de tarea');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Sin scroll horizontal en '+width);
   const old=await page.evaluate(()=>({...localStorage}));
   await page.locator('#assistant-planning-details summary').click();
   await page.locator('#assistant-priority-details summary').click();
   await page.locator('#assistant-priority-details summary').click();
   assert.deepEqual(await page.evaluate(()=>({...localStorage})),old,'Plegar ajustes no modifica registros');
   await page.locator('#assistant-capture input').fill('Revisar temario');
   await page.locator('#assistant-capture button').click();
   assert.match(await page.locator('#assistant-now-task').innerText(),/Revisar temario/);
   assert.equal(await page.locator('#assistant-now-state').innerText(),'De tu bandeja');
   assert.equal(await page.locator('#assistant-focus-next').isEnabled(),true);
   await page.locator('#assistant-what').click();
   assert.equal(await page.locator('#assistant-advice').isVisible(),true);
   await page.locator('#assistant-focus-next').click();
   await page.locator('#productividad').waitFor({state:'visible'});
   assert.equal(await page.locator('#assistant-timer-title').inputValue(),'Revisar temario');
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('rumbo-asistente-v1')).timer),null);
   await page.locator('#assistant-start').click();
   await page.locator('#assistant-pause').click();
   await page.goto(base+'#mi-dia');
   assert.equal(await page.locator('#assistant-now-state').innerText(),'Bloque en pausa');
   assert.match(await page.locator('#assistant-now-task').innerText(),/Revisar temario/);
   assert.equal(await page.locator('#assistant-focus-next').innerText(),'Ver mi bloque');
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('PASS: Mi día sin duplicación, captura, tarea principal, temporizador y paneles plegables en 5 tamaños.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
