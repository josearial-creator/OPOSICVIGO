const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox'],headless:true});
try{for(const width of [320,390,1120]){
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const feed=[{puesto:'Auxiliar administrativo',organismo:'Vigo',grupo:'C2',prioridad:'Alta',inscripcion:'Por verificar',plazas:2,fuente:'https://example.test/1'},{puesto:'Celador',organismo:'SERGAS',grupo:'C2',prioridad:'Media',inscripcion:'Por verificar',plazas:3,fuente:'https://example.test/2'}];
 await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:feed}));
 await page.goto('http://127.0.0.1:8086/#convocatorias');await page.locator('#rows tr').first().waitFor();
 // Keep an existing note and favorite while filtering and navigating.
 await page.getByRole('button',{name:'Alternar favorito',exact:true}).first().click();
 await page.getByRole('button',{name:'Detalle',exact:true}).first().click();await page.locator('#dialog-content textarea').fill('Nota que debe conservarse');await page.locator('#dialog-done').click();
 const iconInside=await page.locator('.filters .search-wrap').evaluate(e=>{const icon=e.querySelector('span').getBoundingClientRect(),input=e.querySelector('input').getBoundingClientRect();return icon.top>=input.top&&icon.bottom<=input.bottom;});assert.equal(iconInside,true,'Icono de búsqueda centrado dentro del campo');
 const snapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('rumbo-replica-v1')));
 await page.locator('#source').selectOption('Vigo');await page.locator('#priority-filter').selectOption('Alta');
 assert.equal(await page.locator('.rumbo-filter-chip').count(),2);assert.equal(await page.locator('#rows tr').count(),1);
 await page.getByRole('button',{name:'Quitar filtro Organismo: Vigo',exact:true}).click();assert.equal(await page.locator('#source').inputValue(),'');assert.equal(await page.locator('#priority-filter').inputValue(),'Alta');assert.match(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),/Quitar filtro Prioridad/);
 await page.keyboard.press('Enter');assert.equal(await page.locator('.rumbo-filter-chip').count(),0);assert.equal(await page.locator('#rumbo-active-filters').isVisible(),false);assert.equal(await page.locator('#priority-filter').evaluate(e=>e===document.activeElement),true);
 await page.locator('#search').fill('<img src=x onerror=alert(1)>');assert.equal(await page.locator('#rows tr').count(),0);assert.equal(await page.locator('#rumbo-active-filters img').count(),0);await page.locator('#search').fill('A'.repeat(180));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
 await page.locator('#clear').click();assert.equal(await page.locator('#rows tr').count(),2);
 for(const [query,target] of [['tareas','productividad'],['mi evolución','mi-evolucion'],['anytype','productividad'],['mi camino','mi-dia'],['emocional observatorio','observatorio-personal']]){
  await page.locator('#rumbo-quick-nav-open').click();const input=page.locator('#rumbo-quick-nav-search');await input.fill(query);assert.equal(await input.getAttribute('role'),'combobox');assert.equal(await input.getAttribute('aria-expanded'),'true');
  const active=await input.getAttribute('aria-activedescendant');assert.ok(active);assert.equal(await page.locator('#'+active).getAttribute('aria-selected'),'true');await input.press('Enter');await page.waitForFunction(id=>document.body.dataset.rumboRoute===id,target);assert.equal(await page.locator('#rumbo-quick-nav-dialog').isVisible(),false);
 }
 await page.locator('#rumbo-quick-nav-open').click();const input=page.locator('#rumbo-quick-nav-search');const first=await input.getAttribute('aria-activedescendant');await input.press('ArrowDown');assert.notEqual(await input.getAttribute('aria-activedescendant'),first);await input.press('ArrowUp');assert.equal(await input.getAttribute('aria-activedescendant'),first);
 await input.fill('zzzz-noexiste');assert.equal(await input.getAttribute('aria-activedescendant'),null);assert.equal(await page.locator('.rumbo-quick-nav-count').innerText(),'0 apartados disponibles');await input.press('Escape');assert.equal(await input.getAttribute('aria-expanded'),'false');
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('rumbo-replica-v1')));assert.deepEqual(after,snapshot);assert.deepEqual(errors,[]);
 await page.screenshot({path:`/tmp/rumbo-mejoras-${width}.png`});await context.close();
}console.log('PASS: sinónimos, búsqueda de varias palabras, combobox, filtros individuales, foco, texto seguro, móvil y favoritos/notas intactos.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
