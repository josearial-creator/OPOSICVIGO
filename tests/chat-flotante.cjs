const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const origin='http://127.0.0.1:8086/',api='https://rumbo-entrenador.jose-arial.workers.dev';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
 try{
  for(const width of [390,1120]){
   const ctx=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   const page=await ctx.newPage(),errors=[];
   const submitted=[];let calls=0;
   page.on('pageerror',err=>errors.push(err.message));
   await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[{puesto:'Auxiliar administrativo C2',organismo:'Concello de Vigo',grupo:'C2',fin:'2027-01-15',convocatoria_id:'demo-chat',fuente:'https://sede.vigo.org/',estado:'Por verificar'}]}));
   await page.route(api+'/**',route=>{
     const req=route.request(),path=new URL(req.url()).pathname;
     const headers={'access-control-allow-origin':'http://127.0.0.1:8086','access-control-allow-headers':'Authorization, Content-Type','access-control-allow-methods':'GET, POST, OPTIONS'};
     if(req.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
     if(path==='/rumbo-assistant'){
       calls++;submitted.push(req.postDataJSON());
       return route.fulfill({status:200,headers,json:{answer:'Veo tu favorita Auxiliar administrativo C2. Comprueba el plazo.',provider:'OpenAI'}});
     }
     if(path==='/notes')return route.fulfill({status:200,headers,json:{notes:[]}});
     return route.fulfill({status:404,headers,json:{error:'Ruta inexistente'}});
   });
   await page.goto(origin+'#convocatorias');
   await page.locator('#rows tr').first().waitFor();
   await page.getByRole('button',{name:'Alternar favorito'}).first().click();
   const before=await page.evaluate(()=>localStorage.getItem('rumbo-replica-v1'));
   const trigger=page.locator('.rumbo-chat-toggle');
   assert.equal(await trigger.isVisible(),true,'Chat flotante visible');
   assert.equal(await page.locator('#rumbo-chat-panel').isVisible(),false,'Panel cerrado inicialmente');
   await trigger.click();
   assert.equal(await page.locator('#rumbo-chat-panel').isVisible(),true);
   await page.locator('[data-rumbo-question="¿Cuáles son mis oposiciones favoritas?"]').click();
   await page.locator('.rumbo-chat-assistant').last().getByText(/Auxiliar administrativo C2/).waitFor();
   assert.equal(calls,0,'Sin consentimiento no hace llamadas externas');
   assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-replica-v1')),before,'Chat local no escribe datos personales');
   await page.locator('#rumbo-chat-input').fill('¿Cómo registro tiempo de estudio?');
   await page.locator('#rumbo-chat-send').click();
   await page.locator('.rumbo-chat-assistant').last().getByText(/Productividad/).waitFor();
   await page.locator('.rumbo-chat-ai summary').click();
   await page.locator('#rumbo-chat-consent').check();
   await page.locator('#rumbo-chat-input').fill('Resume mis convocatorias');
   await page.locator('#rumbo-chat-send').click();
   await page.locator('.rumbo-chat-assistant').last().getByText(/Acceso privado/).waitFor();
   assert.equal(calls,0,'Sin acceso privado no se invoca API de pago');
   await page.evaluate(()=>window.RumboSession.unlock('contraseña-sintetica-de-prueba-muy-larga-123456'));
   await page.evaluate(()=>localStorage.setItem('test-private-note','SECRETO_PERSONAL_SINTETICO'));
   await page.locator('#rumbo-chat-input').fill('¿Cuáles son mis favoritas?');
   await page.locator('#rumbo-chat-send').click();
   await page.locator('.rumbo-chat-assistant').last().getByText(/Veo tu favorita/).waitFor();
   assert.equal(calls,1,'Con acceso y consentimiento se hace una consulta');
   assert.equal(submitted[0].context.consent,true);
   assert.match(submitted[0].context.favorites[0].title,/Auxiliar administrativo C2/);
   assert.equal(JSON.stringify(submitted[0]).includes('SECRETO_PERSONAL_SINTETICO'),false,'No enviar notas');
   assert.equal(JSON.stringify(submitted[0]).includes('contraseña-sintetica'),false,'No enviar contraseña en cuerpo');
   await page.evaluate(()=>window.RumboNavigation.go('mi-dia'));
   await page.locator('#mi-dia').waitFor({state:'visible'});
   assert.equal(await page.locator('#rumbo-chat-panel').isVisible(),true,'Chat permanece disponible al navegar');
   await page.locator('#rumbo-chat-input').press('Escape');
   assert.equal(await page.locator('#rumbo-chat-panel').isVisible(),false,'Escape cierra el chat');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'No hay desbordamiento');
   assert.deepEqual(errors,[],'Sin errores JavaScript');
   await ctx.close();
  }
  console.log('PASS chat Rumbo: panel móvil/escritorio, favoritas, ayuda local gratuita, consentimiento y contexto sin secretos.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
