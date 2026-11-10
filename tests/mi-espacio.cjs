const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('dialog',d=>d.accept());
 const notes=new Map();
 await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({json:[]}));
 await page.route('https://rumbo-entrenador.jose-arial.workers.dev/notes**',async route=>{
  const req=route.request(),url=new URL(req.url()),id=url.pathname.slice('/notes/'.length);
  const cors={'access-control-allow-origin':'http://127.0.0.1:8086','access-control-allow-headers':'Authorization, Content-Type','access-control-allow-methods':'GET, POST, PUT, DELETE, OPTIONS'};
  if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:cors,body:''});return;}
  if(!req.headers().authorization){await route.fulfill({status:401,headers:cors,json:{error:'Sin autorización'}});return;}
  let body={};try{body=req.postDataJSON()||{};}catch{}
  const type=req.method();
  if(type==='GET'){await route.fulfill({headers:cors,json:id?{note:notes.get(id)}:{notes:[...notes.values()]}});return;}
  if(type==='POST'||type==='PUT'){
   const now=new Date().toISOString(),old=notes.get(id);
   const note={id:type==='POST'?'11111111-1111-4111-8111-111111111111':id,text:body.text,mood:body.mood??null,createdAt:old?.createdAt||now,updatedAt:now};
   notes.set(note.id,note);await route.fulfill({status:type==='POST'?201:200,headers:cors,json:{note}});return;
  }
  if(type==='DELETE'){if(id)notes.delete(id);else notes.clear();await route.fulfill({headers:cors,json:{deleted:true}});return;}
 });
 await page.goto('http://127.0.0.1:8086');
 assert.equal(await page.locator('#mi-espacio').count(),1);
 await page.locator('#esp-password').fill('contraseña privada de prueba 1234567890123456');
 await page.locator('#esp-connect').click();
 await page.locator('#esp-private').waitFor({state:'visible'});
 await page.locator('#esp-text').fill('Esta es una nota del diario');
 await page.getByText('Borrador conservado.',{exact:true}).waitFor({timeout:15000});
 await page.reload();
 await page.locator('#esp-password').fill('contraseña privada de prueba 1234567890123456');
 await page.locator('#esp-connect').click();
 await page.locator('#esp-private').waitFor({state:'visible'});
 assert.equal(await page.locator('#esp-text').inputValue(),'Esta es una nota del diario');
 await page.locator('#esp-save').click();
 await page.getByText('Anotación guardada',{exact:true}).waitFor();
 assert.equal(notes.size,1);
 await page.waitForFunction(()=>!document.querySelector('#esp-save').disabled);
 await page.locator('#esp-new').click();
 await page.locator('.esp-note').getByRole('button',{name:'Editar'}).click();
 await page.locator('#esp-text').fill('Nota editada');
 await page.locator('#esp-save').click();
 await page.getByText('Anotación guardada',{exact:true}).waitFor();
 assert.equal([...notes.values()][0].text,'Nota editada');
 await page.waitForFunction(()=>!document.querySelector('#esp-save').disabled);
 await page.locator('.esp-note').getByRole('button',{name:'Borrar'}).click();
 await page.getByText('Anotación borrada.').waitFor();
 assert.equal(notes.size,0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await browser.close();
 console.log('PASS Mi espacio: móvil, borrador tras recarga, guardar, editar y borrar.');
})().catch(e=>{console.error(e);process.exit(1)});
