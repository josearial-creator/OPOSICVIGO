const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox'],headless:true});
 try{
  for(const width of [320,390,1120]){
   const context=await browser.newContext({viewport:{width,height:820},serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({json:[{puesto:'Auxiliar',organismo:'Organismo sintético',grupo:'C2',plazas:1,inscripcion:'Por verificar'}]}));
   await page.goto('http://127.0.0.1:8086/#mi-dia');
   await page.locator('#mi-dia').waitFor({state:'visible'});
   const before=await page.evaluate(()=>({...localStorage}));
   const btn=page.locator('#rumbo-quick-nav-open');
   assert.equal(await btn.isVisible(),true,'Acceso rápido en barra superior');
   await btn.click();
   const dialog=page.locator('#rumbo-quick-nav-dialog');
   assert.equal(await dialog.isVisible(),true);
   await page.locator('#rumbo-quick-nav-search').fill('productividad');
   assert.equal(await page.locator('.rumbo-quick-nav-result').count(),1,'Búsqueda filtrada sin ruido');
   await page.locator('#rumbo-quick-nav-search').press('Enter');
   await page.locator('#productividad').waitFor({state:'visible'});
   assert.equal(await dialog.isVisible(),false);
   assert.equal(await page.evaluate(()=>location.hash),'#productividad');
   await page.keyboard.press('Control+k');
   assert.equal(await dialog.isVisible(),true,'Atajo Ctrl+K abre buscador');
   await page.locator('#rumbo-quick-nav-search').fill('diario');
   await page.locator('#rumbo-quick-nav-results').getByRole('option',{name:/Diario/}).first().click();
   await page.locator('#ev-diary').waitFor({state:'visible'});
   await page.keyboard.press('Control+k');
   await page.locator('#rumbo-quick-nav-search').fill('unapartadoquenoexiste');
   assert.equal(await page.locator('.rumbo-quick-nav-result').count(),0);
   assert.equal(await page.locator('.rumbo-quick-nav-empty').isVisible(),true);
   await page.keyboard.press('Escape');
   assert.equal(await dialog.isVisible(),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'Sin desbordamiento horizontal');
   assert.deepEqual(await page.evaluate(()=>({...localStorage})),before,'La navegación no cambia los datos');
   assert.deepEqual(errors,[],'Sin errores JS');
   await context.close();
  }
  console.log('PASS: navegación rápida, búsqueda, Enter, Ctrl+K, Escape, móvil y datos intactos.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
