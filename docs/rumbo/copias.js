(() => {
'use strict';
const root=document.getElementById('copias-rumbo');if(!root)return;
const KEYS=['rumbo-replica-v1','rumbo-asistente-v1','rumbo-organizacion-v1','rumbo-evolucion-v1','rumbo-historial-importado-v1'];
const enc=new TextEncoder(),dec=new TextDecoder();
root.innerHTML=`<h2>Copias privadas y aplicación instalable</h2>
<p>Guarda una copia cifrada de las convocatorias favoritas, notas, tareas, proyectos y registros de evolución de este navegador. Puedes trasladarla manualmente a otro dispositivo. No hay sincronización automática con la nube.</p>
<div class="backup-layout">
<section><h3>Copia cifrada</h3>
<label>Frase de cifrado (mínimo 12 caracteres)<input type="password" id="backup-pass" autocomplete="new-password"></label>
<label>Repetir frase para crear la copia<input type="password" id="backup-repeat" autocomplete="new-password"></label>
<button class="button primary" type="button" id="backup-export">Descargar copia cifrada</button>
<p>El archivo descargado contiene datos personales cifrados. Conserva la frase por separado; sin ella no se puede recuperar. No incluye contraseñas ni claves privadas.</p></section>
<section><h3>Recuperar en otro dispositivo</h3>
<label>Archivo de copia cifrada<input type="file" id="backup-file" accept=".json,application/json"></label>
<p>Usa la frase anterior. Las demás secciones se sustituyen tras confirmación, pero el <strong>historial privado solo se añade sin borrar registros anteriores</strong>. Guarda primero otra copia de los datos actuales.</p>
<button class="button secondary" type="button" id="backup-import">Verificar y recuperar copia</button>
</section>
</div>
<p id="backup-status" class="backup-status" role="status" aria-live="polite"></p>
<section class="install-area"><h3>Instalar Rumbo</h3><button class="button secondary" id="install-rumbo" type="button">Instalar en este dispositivo</button><p id="install-status" role="status">La instalación depende del navegador. Sin conexión, las funciones de servidor no estarán disponibles.</p></section>`;
const $=id=>document.getElementById(id);
const status=(s)=>{$('backup-status').textContent=s;};
const to64=b=>{let out='';const bytes=new Uint8Array(b);for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out);};
const from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function keyFor(pass,salt){const base=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
const inspect=()=>{
  const stores={};
  for(const k of KEYS){
    const text=localStorage.getItem(k);
    if(text!==null){if(text.length>4000000)throw Error('Datos demasiado grandes para esta copia.');stores[k]=JSON.parse(text);}
  }
  return {version:1,createdAt:new Date().toISOString(),stores};
};
function validData(d){
  if(!d||d.version!==1||!d.stores||typeof d.stores!=='object'||Array.isArray(d.stores))return false;
  const entries=Object.entries(d.stores);
  if(!entries.length||entries.some(([k,v])=>!KEYS.includes(k)||!v||typeof v!=='object'||Array.isArray(v)))return false;
  for(const [k,v] of entries) {
    if(k==='rumbo-replica-v1'&&(!Array.isArray(v.records)||!Array.isArray(v.favorites)||!v.notes||typeof v.notes!=='object'))return false;
    if(k==='rumbo-asistente-v1'&&(v.version!==1||!Array.isArray(v.items)||!Array.isArray(v.sessions)))return false;
    if(k==='rumbo-organizacion-v1'&&(v.version!==1||!Array.isArray(v.projects)))return false;
    if(k==='rumbo-evolucion-v1'&&(v.version!==1||!Array.isArray(v.sessions)||!Array.isArray(v.real)))return false;
    if(k==='rumbo-historial-importado-v1'&&(v.version!==1||!Array.isArray(v.entries)||v.entries.some(e=>!e||typeof e.id!=='string'||!['reflection','situation','quick'].includes(e.kind)||!e.payload||typeof e.payload!=='object')))return false;
  }
  return true;
}
$('backup-export').addEventListener('click',async()=>{
  const pass=$('backup-pass').value;
  if(pass.length<12||pass!==$('backup-repeat').value){status('La frase debe tener al menos 12 caracteres y coincidir en ambos campos.');return;}
  try{
    if(window.RumboHistoryVault){
      const safeguard=await window.RumboHistoryVault.status();
      if(safeguard.archived>safeguard.current)throw Error('Hay registros archivados que no están en la pantalla. Recupéralos desde Diario antes de descargar la copia.');
      await window.RumboHistoryVault.protectCurrent();
    }
    const data=inspect();if(!Object.keys(data.stores).length)throw Error('No hay datos locales que exportar.');
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const key=await keyFor(pass,salt);
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(data)));
    const pack={type:'rumbo-copia-cifrada',version:1,kdf:'PBKDF2-SHA256',iterations:250000,cipher:'AES-256-GCM',salt:to64(salt),iv:to64(iv),data:to64(ciphertext)};
    const url=URL.createObjectURL(new Blob([JSON.stringify(pack)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='rumbo-copia-cifrada-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    $('backup-pass').value='';$('backup-repeat').value='';
    status('Copia cifrada creada. Guarda el archivo y la frase por separado.');
  }catch(e){status('No se pudo generar la copia: '+e.message);}
});
$('backup-import').addEventListener('click',async()=>{
  const f=$('backup-file').files?.[0],pass=$('backup-pass').value;
  if(!f||!pass){status('Selecciona el archivo e introduce su frase de cifrado en el campo superior.');return;}
  if(f.size>10000000){status('El archivo supera el límite de seguridad de 10 MB.');return;}
  try{
    const pack=JSON.parse(await f.text());
    if(pack.type!=='rumbo-copia-cifrada'||pack.version!==1||pack.iterations!==250000||pack.cipher!=='AES-256-GCM')throw Error('Formato no reconocido.');
    const salt=from64(pack.salt),iv=from64(pack.iv);if(salt.length!==16||iv.length!==12)throw Error('Parámetros no válidos.');
    const key=await keyFor(pass,salt),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,from64(pack.data));
    const restored=JSON.parse(dec.decode(plain));if(!validData(restored))throw Error('Estructura de los datos no válida.');
    const raw=Object.fromEntries(Object.entries(restored.stores).map(([k,v])=>[k,JSON.stringify(v)]));
    if(Object.values(raw).some(x=>x.length>4000000))throw Error('Datos demasiado grandes.');
    if(!confirm('¿Recuperar esta copia? Las demás secciones se sustituirán. El historial privado solo añadirá registros nuevos y conservará los existentes.')){status('Recuperación cancelada sin cambios.');return;}
    const HISTORY='rumbo-historial-importado-v1';
    const previous=Object.fromEntries(KEYS.filter(k=>k!==HISTORY).map(k=>[k,localStorage.getItem(k)]));
    try{
      for(const [k,v] of Object.entries(raw))if(k!==HISTORY)localStorage.setItem(k,v);
      if(restored.stores[HISTORY]){
        if(!window.RumboHistoryVault)throw Error('La bóveda del historial no está disponible: no se continuará la recuperación.');
        await window.RumboHistoryVault.mergeStore(restored.stores[HISTORY]);
      }
    }catch(e){
      for(const [k,v] of Object.entries(previous)){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch{}}
      throw Error('No se completó la recuperación; se intentó revertir las demás secciones sin borrar el historial: '+e.message);
    }
    status('Datos recuperados. El historial se ha combinado sin sustituciones. Recargando la página.');location.reload();
  }catch(e){status('No se recuperó la copia: contraseña, archivo o datos no válidos. '+(e.message==='The operation failed for an operation-specific reason'?'':e.message));}
});
$('install-rumbo').addEventListener('click',()=>window.RumboInstall?.());
})();