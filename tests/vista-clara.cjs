const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({
   executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),
   args:['--no-sandbox'],headless:true
 });
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[]}));
  await page.goto('http://127.0.0.1:8086/#mi-espacio');
  await page.locator('#mi-espacio').waitFor({state:'visible'});
  assert.equal(await page.locator('link[href="vista-clara.css"]').count(),1);
  assert.equal(await page.locator('#rumbo-current-section').innerText(),'Rumbo · Mi espacio');
  assert.equal(await page.locator('#historial-rumbo').isVisible(),false);
  assert.equal(await page.locator('.rumbo-section-nav a[aria-current="page"]').getAttribute('href'),'#mi-espacio');
  assert.equal(await page.locator('.rumbo-section-links').evaluate(el=>getComputedStyle(el).display),'grid');
  assert.equal(await page.locator('.rumbo-section-nav a[href="#mi-espacio"]').evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
  assert.ok(await page.locator('#esp-password').evaluate(el=>el.getBoundingClientRect().width>230));
  const invariant=await page.evaluate(()=>{
    localStorage.setItem('rumbo-prueba-visual','conservar');
    return localStorage.getItem('rumbo-historial-importado-v1');
  });
  for(const width of [320,390,560,768,1120]){
    await page.setViewportSize({width,height:844});
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Sin desbordamiento horizontal a '+width+'px');
    assert.equal(await page.locator('#mi-espacio').isVisible(),true,'Mi espacio visible a '+width+'px');
    assert.equal(await page.locator('#historial-rumbo').isVisible(),false,'Otras pantallas ocultas a '+width+'px');
    const active=page.locator('.rumbo-section-nav a[aria-current="page"]');
    assert.equal(await active.count(),1);
    assert.ok(await active.evaluate(el=>el.getBoundingClientRect().height>=44),'Botón accesible');
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('.rumbo-section-nav a[href="#historial-rumbo"]').click();
  await page.locator('#historial-rumbo').waitFor({state:'visible'});
  assert.equal(await page.locator('#rumbo-current-section').innerText(),'Rumbo · Historial');
  await page.locator('[data-mobile-tab="hoy"]').click();
  await page.locator('.rumbo-section-nav a[href="#inicio"]').click();
  await page.locator('.hero-line').waitFor({state:'visible'});
  assert.equal(await page.locator('.quick-actions').evaluate(el=>getComputedStyle(el).display),'grid','Portada sin carrusel horizontal');
  assert.equal(await page.locator('.quick-action').count(),3);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-prueba-visual')),'conservar');
  assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-historial-importado-v1')),invariant);
  const css=await page.request.get('http://127.0.0.1:8086/vista-clara.css');
  assert.equal(css.status(),200);
  const sw=await page.request.get('http://127.0.0.1:8086/sw.js');
  const swText=await sw.text();
  assert.match(swText,/rumbo-shell-v14/);
  assert.match(swText,/\.\/vista-clara\.css/);
  assert.deepEqual(errors,[]);
  console.log('PASS vista clara: 320/390/560/768/1120px, contraste, encabezados, botones, navegación, caché y datos conservados.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
