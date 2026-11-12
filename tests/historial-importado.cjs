const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
try{
const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[{puesto:'Auxiliar',organismo:'Vigo',plazas:2}]}));
await page.goto('http://127.0.0.1:8086/');
assert.match(await page.locator('#history-recovery-count').innerText(),/Aún no hay registros importados/);
// La portada debe aceptar directamente el archivo sin buscar el importador en el Diario.
const preview=await browser.newPage({viewport:{width:390,height:844}});
await preview.route('https://raw.githubusercontent.com/**',r=>r.fulfill({json:[{puesto:'Auxiliar',organismo:'Vigo',plazas:2}]}));
await preview.goto('http://127.0.0.1:8086/');
const importedFromHome={type:'rumbo-migracion-local-v1',version:1,
 reflections:Array.from({length:121},(_,i)=>({
  id:'registro-ficticio-'+i,date:'2026-11-10',title:'Reflexión ficticia '+i,
  summary:'Texto ficticio de prueba '+i,reported:'Dato de prueba'
 })),
 psychology:{days:[{date:'2026-11-10',
  situations:Array.from({length:10},(_,i)=>({id:'situacion-'+i,text:'Situación ficticia '+i})),
  quick:{text:'Apunte ficticio'}
 }]}
};
await preview.locator('#history-home-file').setInputFiles({
 name:'132-registros-ficticios.json',mimeType:'application/json',
 buffer:Buffer.from(JSON.stringify(importedFromHome))
});
await preview.locator('#historic-status').waitFor({state:'visible'});
assert.match(await preview.locator('#historic-status').innerText(),/Importación completada: 132 nuevos registros/);
assert.equal(await preview.locator('#historic-total').innerText(),'132');
assert.match(await preview.locator('#history-recovery-count').innerText(),/132 registros disponibles/);
assert.equal(await preview.evaluate(()=>location.hash),'#historial-rumbo');
await preview.reload();
assert.equal(await preview.locator('#historic-total').innerText(),'132');
await page.evaluate(async()=>{
 const db=await new Promise((resolve,reject)=>{
  const q=indexedDB.open('rumbo-boveda-historial-v1',1);
  q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
 });
 await new Promise((resolve,reject)=>{
  const tx=db.transaction('snapshots','readwrite');
  tx.objectStore('snapshots').clear();
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });db.close();
 localStorage.removeItem('rumbo-historial-importado-v1');
});
await preview.reload();await preview.close();
await page.goto('http://127.0.0.1:8086/#historial-rumbo');
await page.locator('#historial-rumbo').waitFor({state:'visible'});
assert.equal(await page.locator('[data-mobile-tab="diario"]').getAttribute('aria-current'),'page');
await page.locator('[data-mobile-tab="diario"]').click();
await page.locator('#historial-rumbo').waitFor({state:'visible'});
const imported={type:'rumbo-migracion-local-v1',version:1,reflections:[
{id:'ref1',date:'2026-11-10',title:'Ejemplo <img src=x onerror=alert(1)>',summary:'Resumen <script>peligro</script>',reported:'Palabras de prueba',conversationUrl:'https://chatgpt.com/c/abc'},
{id:'ref2',date:'2026-11-09',title:'Otra reflexión',summary:'Segundo resumen',reported:'Más texto'}
],psychology:{days:[{date:'2026-11-10',situations:[{id:'s1',text:'Una situación',nerves:6}],quick:{text:'Apunte diario',stop:'Sí',help:'Ejemplo'}}]}};
const file={name:'recuperacion.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))};
await page.locator('#historic-files').setInputFiles(file);
await page.locator('#historic-import').click();
await page.locator('#historic-status').filter({hasText:/Importación completada: 4 nuevos registros/}).waitFor();
assert.equal(await page.locator('#historic-total').innerText(),'4');
assert.match(await page.locator('#history-recovery-count').innerText(),/4 registros disponibles/);
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
await page.locator('#historic-status').filter({hasText:/todos los identificadores ya estaban importados/}).waitFor();
assert.equal(await page.locator('#historic-total').innerText(),'4');
await page.locator('#historic-search').fill('Segundo resumen');
assert.equal(await page.locator('.historic-record').count(),1);
await page.locator('#historic-search').fill('');
const download=page.waitForEvent('download');await page.locator('#historic-export').click();
assert.equal((await download).suggestedFilename(),'rumbo-historial-recuperado.json');
// La actualización de estilos o la eliminación accidental de la clave local no borra el archivo separado.
await page.evaluate(()=>localStorage.removeItem('rumbo-historial-importado-v1'));
await page.reload();await page.locator('[data-mobile-tab="diario"]').click();
await page.locator('#historic-status').filter({hasText:/historial está archivado/}).waitFor();
assert.equal(await page.locator('#historic-total').innerText(),'0');
// Una copia cifrada no debe ocultar que existen cuatro registros archivados.
await page.locator('[data-mobile-tab="mas"]').click();
await page.locator('#backup-pass').fill('frase-segura-de-prueba');
await page.locator('#backup-repeat').fill('frase-segura-de-prueba');
await page.locator('#backup-export').click();
await page.locator('#backup-status').filter({hasText:/Hay registros archivados que no están en la pantalla/}).waitFor();
await page.locator('[data-mobile-tab="diario"]').click();
await page.locator('#historic-vault-restore').click();
await page.locator('#historic-status').filter({hasText:/Recuperación verificada: 4 entradas restauradas/}).waitFor();
assert.equal(await page.locator('#historic-total').innerText(),'4');
const preserved=await page.evaluate(()=>localStorage.getItem('rumbo-historial-importado-v1'));
const altered=await page.evaluate(async()=>{
 const value=JSON.parse(localStorage.getItem('rumbo-historial-importado-v1'));
 value.entries[0].title='Sustitución destructiva';
 try{await window.RumboHistoryVault.mergeStore(value);return false;}catch{return true;}
});
assert.equal(altered,true);
assert.equal(await page.evaluate(()=>localStorage.getItem('rumbo-historial-importado-v1')),preserved);
// Una copia cifrada antigua puede recuperar otros módulos, pero no borrar
// un registro añadido después al historial.
await page.locator('[data-mobile-tab="mas"]').click();
await page.locator('#backup-pass').fill('frase-segura-de-prueba');
await page.locator('#backup-repeat').fill('frase-segura-de-prueba');
const pendingDownload=page.waitForEvent('download');
await page.locator('#backup-export').click();
const encryptedFile=await pendingDownload;
const fs=require('node:fs');
const encrypted=fs.readFileSync(await encryptedFile.path());
await page.evaluate(async()=>{
 const current=JSON.parse(localStorage.getItem('rumbo-historial-importado-v1'));
 current.entries.push({id:'reflection:posterior',kind:'reflection',date:'2026-11-11',title:'Entrada posterior',payload:{title:'Entrada posterior',summary:'Debe sobrevivir'}});
 await window.RumboHistoryVault.mergeStore(current);
});
await page.locator('#backup-file').setInputFiles({name:'copia-antigua.json',mimeType:'application/json',buffer:encrypted});
page.once('dialog',dialog=>dialog.accept());
await page.locator('#backup-pass').fill('frase-segura-de-prueba');
await page.locator('#backup-import').click();
await page.waitForFunction(()=>JSON.parse(localStorage.getItem('rumbo-historial-importado-v1')||'{}').entries?.length===5);
await page.reload();await page.locator('[data-mobile-tab="diario"]').click();
assert.equal(await page.locator('#historic-total').innerText(),'5');
await page.reload();await page.locator('[data-mobile-tab="diario"]').click();
assert.equal(await page.locator('#historic-total').innerText(),'5');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
assert.deepEqual(errors,[]);
console.log('PASS historial: importa reflexiones, situaciones y apunte, deduplica, persiste, exporta, busca y evita XSS.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});