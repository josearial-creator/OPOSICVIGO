const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8086';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox'],headless:true});
 const feed=Array.from({length:6},(_,i)=>({puesto:'Convocatoria sintética '+i,organismo:'Organismo de prueba',grupo:'C2',plazas:1,fuente:'https://example.test/plaza/'+i,inscripcion:'Por verificar'}));
 try{
  for(const width of [390,1120]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install({time:new Date('2026-11-18T10:00:00Z')});
   await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:feed}));
   await page.goto(base+'/');
   await page.locator('#rows tr').first().waitFor({state:'attached'});
   assert.equal(await page.locator('.hero-line').isVisible(),true);
   assert.equal(await page.locator('link[href="portada-navegacion.css"]').count(),1,'Diseño de Google enlazado');
   assert.equal(await page.locator('.sidebar .rumbo-nav-svg').count()>0,true,'Iconos SVG del diseño integrados');
   const visual=await page.evaluate(()=>({
    accent:getComputedStyle(document.querySelector('.brand-mark')).backgroundColor,
    primary:getComputedStyle(document.querySelector('.hero-cta-primary')).backgroundColor,
    accessHeight:parseFloat(getComputedStyle(document.querySelector('#rumbo-access-open')).minHeight),
    navPosition:getComputedStyle(document.querySelector('.topbar')).position
   }));
   assert.equal(visual.accent,'rgb(11, 110, 100)','Color de marca de Gemini');
   assert.equal(visual.primary,'rgb(11, 110, 100)','Botón principal mantiene estilo Gemini');
   assert.equal(visual.accessHeight>=44,true,'Acceso privado accesible al tacto');
   const account=page.locator('#rumbo-access-open');
   assert.match(await account.getAttribute('aria-label'),/Acceso privado|Abrir acceso privado|Recuperando acceso/i);
   const accountAppearance=await account.evaluate(el=>({
     icon:getComputedStyle(el,'::before').maskImage || getComputedStyle(el,'::before').webkitMaskImage,
     width:el.getBoundingClientRect().width,
     fontSize:parseFloat(getComputedStyle(el).fontSize)
   }));
   assert.match(accountAppearance.icon,/data:image\/svg\+xml/,'Icono de perfil presente');
   assert.equal(accountAppearance.width>=44,true,'Botón de cuenta accesible al tacto');
   if(width<560)assert.equal(accountAppearance.fontSize,0,'En móvil solo ocupa el espacio del icono');

   assert.equal(visual.navPosition,width<560?'static':'sticky','Barra superior adaptada al dispositivo');
   for(const id of ['convocatorias','mi-espacio','productividad','mi-evolucion','proyectos'])assert.equal(await page.locator('#'+id).isVisible(),false,'La portada no apila '+id);
   assert.equal(await page.title(),'Portada · Rumbo');
   await page.locator('.rumbo-section-nav a[href="#panel-hoy"]').click();
   await page.locator('#today-actions').getByRole('button',{name:'Explorar convocatorias',exact:true}).click();
   await page.locator('#convocatorias').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>location.hash),'#convocatorias');
   await page.waitForFunction(()=>document.activeElement?.tagName==='H2'&&document.activeElement.textContent==='Convocatorias');
   assert.equal(await page.title(),'Convocatorias · Rumbo');
   assert.equal(await page.locator('#panel-hoy').isVisible(),false);
   for(const b of await page.getByRole('button',{name:'Alternar favorito',exact:true}).all())await b.click();
   await page.goBack();await page.locator('#panel-hoy').waitFor({state:'visible'});
   await page.getByRole('button',{name:'Ver todas mis favoritas',exact:true}).click();
   await page.locator('#convocatorias').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>location.hash),'#favoritos');
   assert.equal(await page.locator('#only-favs').isChecked(),true);
   assert.equal(await page.locator('#rows tr').count(),6);
   await page.goto(base+'/#estudio');
   await page.locator('#productividad').waitFor({state:'visible'});
   await page.locator('#assistant-timer-title').fill('Bloque sintético de navegación');
   await page.locator('#assistant-duration').selectOption('5');await page.locator('#assistant-start').click();
   await page.clock.fastForward(65000);
   assert.equal(await page.locator('#running-block').isVisible(),false,'Sin reloj duplicado dentro de Productividad');
   const before=await page.evaluate(()=>localStorage.getItem('rumbo-asistente-v1'));
   if(width<560)await page.locator('[data-mobile-tab="hoy"]').click();else await page.locator('.sidebar a[href="#mi-dia"]').click();
   await page.locator('#running-block').waitFor({state:'visible'});
   assert.equal(await page.locator('.running-block-title').innerText(),'Bloque sintético de navegación');
   const left=await page.locator('.running-block-clock').innerText();assert.match(left,/^03:5[0-5]$/);
   assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-asistente-v1')),before,'La navegación y el aviso no escriben el temporizador');
   await page.locator('#running-block a').click();await page.locator('#productividad').waitFor({state:'visible'});
   await page.locator('#assistant-pause').click();
   const used=await page.evaluate(()=>JSON.parse(localStorage.getItem('rumbo-asistente-v1')).timer.elapsed);
   if(width<560)await page.locator('[data-mobile-tab="hoy"]').click();else await page.locator('.sidebar a[href="#mi-dia"]').click();
   assert.equal(await page.locator('.running-block-state').innerText(),'Bloque en pausa');
   const paused=await page.locator('.running-block-clock').innerText();await page.clock.fastForward(50000);assert.equal(await page.locator('.running-block-clock').innerText(),paused);
   await page.reload();await page.locator('#running-block').waitFor({state:'visible'});assert.equal(await page.locator('.running-block-clock').innerText(),paused);
   await page.locator('#running-block a').click();await page.locator('#assistant-finish').click();
   if(width<560)await page.locator('[data-mobile-tab="hoy"]').click();else await page.locator('.sidebar a[href="#mi-dia"]').click();
   assert.equal(await page.locator('#running-block').isVisible(),false);const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('rumbo-asistente-v1')));assert.equal(data.sessions.length,1);assert.equal(data.sessions[0].seconds,used);
   await page.goto(base+'/#apartado-inexistente');assert.equal(await page.locator('.hero-line').isVisible(),true);assert.equal(await page.title(),'Portada · Rumbo');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: portada limpia, accesos de radar/favoritas, foco de teclado, enlaces antiguos, bloque activo y datos conservados en móvil y escritorio.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
