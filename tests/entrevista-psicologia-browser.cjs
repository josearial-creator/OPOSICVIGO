const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox'],headless:true});try{
 const ctx=await browser.newContext({viewport:{width:390,height:840},serviceWorkers:'block'}),page=await ctx.newPage();
 await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[]}));
 await page.goto('http://127.0.0.1:8086/#observatorio-personal');
 await page.locator('#obs-password').fill('solo-prueba-ficticia-2026');await page.locator('#obs-remember').uncheck();await page.locator('#obs-open').click();
 const panel=page.locator('#obs-interview'),field=id=>panel.locator('[data-field="'+id+'"]');await panel.waitFor({state:'visible'});
 const before=await page.evaluate(()=>localStorage.getItem('rumbo-observatorio-encrypted-v1'));
 await field('context').fill('Situación de prueba ficticia. Tengo ansiedad.');await field('preview').click();assert.match(await field('hints').innerText(),/Emoción/);await panel.locator('summary').click();await panel.locator('input[value=situacion]').check();await field('start').click();assert.match(await field('question').innerText(),/significado/);
 await field('answer').fill('Pensé que la tarea era difícil.');await field('next').click();assert.match(await field('question').innerText(),/sentiste/);
 await field('skip').click();await field('answer').fill('He logrado detenerme.');await field('finish').click();assert.match(await field('result').inputValue(),/He logrado detenerme/);assert.doesNotMatch(await field('result').inputValue(),/¿/);
 await field('transfer').click();assert.match(await page.locator('#obs-text').inputValue(),/He logrado detenerme/);assert.ok(await page.locator('#obs-suggestions .obs-suggestion').count()>=1);assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-observatorio-encrypted-v1')),before);
 await field('context').fill('Borrador privado ficticio.');await field('start').click();await field('answer').fill('No guardar.');await page.locator('#obs-lock').click();await page.locator('#obs-locked').waitFor({state:'visible'});assert.equal(await field('answer').inputValue(),'');assert.equal(await field('result').inputValue(),'');assert.equal(await page.locator('#obs-text').inputValue(),'');await ctx.close();
 console.log('PASS entrevista: adaptación, revisión, traslado sin guardado y limpieza al cerrar.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
