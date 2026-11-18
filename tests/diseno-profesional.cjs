const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox'],headless:true});
 try{
  for(const width of [320,390,560,768,1120]){
   const context=await browser.newContext({viewport:{width,height:820},serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({json:[]}));
   await page.goto('http://127.0.0.1:8086/#mi-espacio');
   await page.locator('#mi-espacio').waitFor({state:'visible'});
   assert.equal(await page.locator('link[href="producto-profesional.css"]').count(),1,'Hoja de diseño activa');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Sin desbordamiento horizontal en '+width);
   assert.equal(await page.locator('.rumbo-section-nav a[aria-current=page]').count(),1,'Solo un apartado activo');
   assert.equal(await page.locator('.rumbo-section-links a[aria-current=page]').getAttribute('href'),'#mi-espacio');
   const bg=await page.locator('.rumbo-section-nav').evaluate(element=>getComputedStyle(element).backgroundColor);
   assert.equal(bg,'rgb(255, 255, 255)','Superficie de navegación coherente');
   const before=await page.evaluate(()=>Object.assign({},localStorage));
   const hash=await page.evaluate(()=>location.hash);
   await page.keyboard.press('Tab');
   await page.evaluate(()=>document.querySelector('.rumbo-skip-link').focus());
   await page.keyboard.press('Enter');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'contenido-principal','Saltar menús mueve el foco');
   assert.equal(await page.evaluate(()=>location.hash),hash,'Saltar menús conserva la pantalla');
   assert.deepEqual(await page.evaluate(()=>Object.assign({},localStorage)),before,'El diseño no escribe datos');
   await page.locator('.rumbo-section-nav a[href="#ev-diary"]').click();
   await page.locator('#ev-diary').waitFor({state:'visible'});
   assert.equal(await page.locator('#mi-espacio').isVisible(),false,'Pantallas independientes');
   assert.deepEqual(errors,[],'Sin errores de JavaScript');
   await context.close();
  }
  console.log('PASS: diseño profesional, 320/390/560/768/1120px, navegación, accesibilidad y datos.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
