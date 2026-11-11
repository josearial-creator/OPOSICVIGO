const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
try{
const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[{puesto:'Auxiliar',organismo:'Vigo',plazas:2}]}));
await page.goto('http://127.0.0.1:8086/');
await page.locator('[data-mobile-tab="diario"]').click();
await page.locator('#historial-rumbo').waitFor({state:'visible'});
const imported={type:'rumbo-migracion-local-v1',version:1,reflections:[
{id:'ref1',date:'2026-11-10',title:'Ejemplo <img src=x onerror=alert(1)>',summary:'Resumen <script>peligro</script>',reported:'Palabras de prueba',conversationUrl:'https://chatgpt.com/c/abc'},
{id:'ref2',date:'2026-11-09',title:'Otra reflexión',summary:'Segundo resumen',reported:'Más texto'}
],psychology:{days:[{date:'2026-11-10',situations:[{id:'s1',text:'Una situación',nerves:6}],quick:{text:'Apunte diario',stop:'Sí',help:'Ejemplo'}}]}};
const file={name:'recuperacion.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))};
await page.locator('#historic-files').setInputFiles(file);
await page.locator('#historic-import').click();
await page.getByText(/Importación completada: 4 nuevos registros/).waitFor();
assert.equal(await page.locator('#historic-total').innerText(),'4');
await page.getByText(/Copias archivadas: 1/).waitFor();
assert.equal(await page.evaluate(async()=>{const s=await window.RumboHistoryVault.status();return s.current===4&&s.archived===4;}),true);
assert.equal(await page.locator('#historic-reflections').innerText(),'2');
assert.equal(await page.locator('#historic-situations').innerText(),'1');
assert.equal(await page.locator('#historic-quick').innerText(),'1');
assert.equal(await page.locator('#historial-rumbo img').count(),0);
assert.equal(await page.locator('#historial-rumbo script').count(),0);
await page.reload();await page.locator('[data-mobile-tab="diario"]').click();
assert.equal(await page.locator('#historic-total').innerText(),'4');
await page.locator('#historic-files').setInputFiles(file);await page.locator('#historic-import').click();
await page.getByText(/todos los identificadores ya estaban importados/).waitFor();
assert.equal(await page.locator('#historic-total').innerText(),'4');
await page.locator('#historic-search').fill('Segundo resumen');
assert.equal(await page.locator('.historic-record').count(),1);
await page.locator('#historic-search').fill('');
const download=page.waitForEvent('download');await page.locator('#historic-export').click();
assert.equal((await download).suggestedFilename(),'rumbo-historial-recuperado.json');
// La actualización de estilos o la eliminación accidental de la clave local no borra el archivo separado.
await page.evaluate(()=>localStorage.removeItem('rumbo-historial-importado-v1'));
await page.reload();await page.locator('[data-mobile-tab="diario"]').click();
await page.getByText(/historial está archivado/).waitFor();
assert.equal(await page.locator('#historic-total').innerText(),'0');
await page.locator('#historic-vault-restore').click();
await page.getByText(/Recuperación verificada: 4 entradas restauradas/).waitFor();
assert.equal(await page.locator('#historic-total').innerText(),'4');
const preserved=await page.evaluate(()=>localStorage.getItem('rumbo-historial-importado-v1'));
const altered=await page.evaluate(async()=>{
 const value=JSON.parse(localStorage.getItem('rumbo-historial-importado-v1'));
 value.entries[0].title='Sustitución destructiva';
 try{await window.RumboHistoryVault.mergeStore(value);return false;}catch{return true;}
});
assert.equal(altered,true);
assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-historial-importado-v1')),preserved);
await page.reload();await page.locator('[data-mobile-tab="diario"]').click();
assert.equal(await page.locator('#historic-total').innerText(),'4');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
assert.deepEqual(errors,[]);
console.log('PASS historial: importa reflexiones, situaciones y apunte, deduplica, persiste, exporta, busca y evita XSS.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});