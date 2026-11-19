(() => {
 'use strict';
 // Favoritos entre dispositivos: solo se envían instantáneas cifradas AES-GCM.
 // La contraseña compartida es temporal; no se guarda en localStorage ni en cookies.
 const API='https://rumbo-entrenador.jose-arial.workers.dev/favorites';
 const META='rumbo-favs-revisions-v1', MAX=2500;
 const enc=new TextEncoder(),dec=new TextDecoder(),link=window.RumboFavoritesLink;
 const label=document.getElementById('favorites-sync-status');
 const button=document.getElementById('favorites-sync-now');
 if(!link||!label||!button)return;
 let working=false,again=false,generation=0,lastSuccess=0;
 const say=message=>{label.textContent=message;};
 const bytesTo64=data=>{
  let text='';const bytes=new Uint8Array(data);
  for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(text);
 };
 const from64=s=>Uint8Array.from(atob(s),ch=>ch.charCodeAt(0));
 const hex=data=>Array.from(new Uint8Array(data),x=>x.toString(16).padStart(2,'0')).join('');
 const idOf=s=>crypto.subtle.digest('SHA-256',enc.encode(s)).then(hex);
 const validEntry=r=>r&&typeof r==='object'&&!Array.isArray(r)&&
  Object.keys(r).sort().join(',')==='at,key,nonce,selected'&&
  typeof r.key==='string'&&r.key.length>0&&r.key.length<=1400&&
  typeof r.selected==='boolean'&&Number.isSafeInteger(r.at)&&r.at>=0&&r.at<20000000000000&&
  typeof r.nonce==='string'&&r.nonce.length>0&&r.nonce.length<=80;
 const sort=a=>[...a].sort((x,y)=>x.key<y.key?-1:x.key>y.key?1:0);
 function validEntries(entries){
  if(!Array.isArray(entries)||entries.length>MAX||!entries.every(validEntry)||
     new Set(entries.map(x=>x.key)).size!==entries.length)throw Error('Preferencias incompatibles: se conservan los favoritos locales.');
  return sort(entries);
 }
 function readLocal(){
  const raw=localStorage.getItem(META);
  const parsed=raw?JSON.parse(raw):{version:1,entries:[]};
  if(parsed?.version!==1)throw Error('Metadatos locales desconocidos. No se han sustituido.');
  const entries=validEntries(parsed.entries);
  const map=new Map(entries.map(e=>[e.key,e]));
  for(const key of link.get()){
   if(typeof key!=='string'||!key||key.length>1400)throw Error('Identificador local incompatible.');
   // Favoritos anteriores a la sincronización: marca inicial con prioridad baja.
   if(!map.has(key))map.set(key,{key,selected:true,at:0,nonce:'legacy'});
  }
  return {raw,entries:sort(map.values())};
 }
 function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
 const rank=e=>[e.at,e.nonce];
 const newer=(a,b)=>!b||a.at>b.at||(a.at===b.at&&a.nonce>b.nonce);
 const auth=pass=>'Rumbo '+bytesTo64(enc.encode(pass));
 const verify=(pass,gen)=>{
  if(gen!==generation||!window.RumboSession?.available()||window.RumboSession.use()!==pass)
    throw Error('Acceso privado cerrado; se ha detenido la sincronización.');
 };
 async function derivation(pass,salt){
  const material=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:260000,hash:'SHA-256'},
    material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 }
 async function encrypt(entries,pass,id){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await derivation(pass,salt),enc.encode(JSON.stringify({version:1,entries})));
  return {version:1,id,createdAt:new Date().toISOString(),count:entries.length,
    salt:bytesTo64(salt),iv:bytesTo64(iv),cipher:bytesTo64(cipher)};
 }
 async function decrypt(snapshot,pass){
  if(!snapshot||snapshot.version!==1||!/^[a-f0-9]{64}$/.test(snapshot.id)||typeof snapshot.cipher!=='string')
    throw Error('Copia de favoritos incompatible.');
  const salt=from64(snapshot.salt),iv=from64(snapshot.iv);
  if(salt.length!==16||iv.length!==12)throw Error('Copia privada dañada.');
  let result;
  try{result=await crypto.subtle.decrypt({name:'AES-GCM',iv},await derivation(pass,salt),from64(snapshot.cipher));}
  catch{throw Error('Una copia remota no se puede descifrar con esta contraseña; no se han sustituido favoritos.');}
  const data=JSON.parse(dec.decode(result));
  if(data?.version!==1)throw Error('Formato de copia remota desconocido.');
  const entries=validEntries(data.entries);
  if(entries.length!==snapshot.count||await idOf(JSON.stringify({version:1,entries}))!==snapshot.id)
    throw Error('La copia remota no supera la comprobación de integridad.');
  return entries;
 }
 async function call(path,pass,options={}){
  const response=await fetch(API+path,{method:options.body?'POST':'GET',
   headers:{Authorization:auth(pass),...(options.body?{'Content-Type':'application/json'}:{})},
   body:options.body?JSON.stringify(options.body):undefined,
   cache:'no-store',signal:AbortSignal.timeout(25000)});
  if(!response.ok){
   if(response.status===404)throw Error('El servidor aún no tiene activada la sincronización de favoritos.');
   if(response.status===401)throw Error('El acceso privado fue rechazado por el servidor.');
   if(response.status===403)throw Error('Esta dirección no está autorizada para sincronizar.');
   throw Error('El servidor privado no está disponible (HTTP '+response.status+').');
  }
  return response.json();
 }
 async function versions(pass,gen){
  const found=new Set();let cursor=null;
  for(let page=0;page<30;page++){
   verify(pass,gen);
   const data=await call(cursor?'?cursor='+encodeURIComponent(cursor):'',pass);
   if(!Array.isArray(data.versions))throw Error('Listado remoto inesperado.');
   for(const row of data.versions){
    if(!/^[a-f0-9]{64}$/.test(row.id))throw Error('Identificador de copia no válido.');
    found.add(row.id);
   }
   if(!data.cursor)return found;
   if(typeof data.cursor!=='string'||data.cursor===cursor)throw Error('Paginación remota inválida.');
   cursor=data.cursor;
  }
  throw Error('Hay demasiadas versiones: no se modifica el historial de favoritos.');
 }
 async function sync(){
  if(!window.RumboSession?.available()){
   say('Favoritos de este dispositivo. Entra en «Acceso privado» en el ordenador y en el móvil para compartirlos.');
   button.hidden=true;return;
  }
  if(working){again=true;return;}
  working=true;button.disabled=true;button.hidden=false;
  const pass=window.RumboSession.use(),gen=generation;
  try{
   if(!crypto?.subtle)throw Error('La sincronización cifrada necesita HTTPS.');
   say('Comparando favoritos cifrados entre dispositivos…');
   const initial=readLocal();
   const remoteIds=await versions(pass,gen);
   const merged=new Map(initial.entries.map(e=>[e.key,e]));
   for(const id of remoteIds){
    verify(pass,gen);
    const data=await call('/'+id,pass);
    const entries=await decrypt(data.snapshot,pass);
    for(const e of entries)if(newer(e,merged.get(e.key)))merged.set(e.key,e);
   }
   verify(pass,gen);
   // Si se marcó otra estrella mientras se consultaba la nube, reintentar sin pisarla.
   if(localStorage.getItem(META)!==initial.raw||
      link.get().some(k=>!initial.entries.some(e=>e.key===k&&e.selected))){
     again=true;return;
   }
   const entries=sort(merged.values());
   const selected=entries.filter(e=>e.selected).map(e=>e.key);
   const current=new Set(link.get()),next=new Set(selected);
   if(current.size!==next.size||[...current].some(x=>!next.has(x))){
     if(!link.apply(selected))throw Error('Cambios locales desde otra pestaña: no se sustituyeron.');
   }
   verify(pass,gen);
   // Se guardan los metadatos locales solo después de conservar los favoritos en Rumbo.
   localStorage.setItem(META,JSON.stringify({version:1,entries}));
   const id=await idOf(JSON.stringify({version:1,entries}));
   if(!remoteIds.has(id)){
     say('Guardando favoritos cifrados…');
     const snapshot=await encrypt(entries,pass,id);
     verify(pass,gen);
     try{await call('',pass,{body:snapshot});}
     catch(error){
       if(!/HTTP 409/.test(error.message))throw error;
       // Otro dispositivo pudo guardar el mismo contenido simultáneamente.
     }
     verify(pass,gen);
     const confirmed=await call('/'+id,pass);
     await decrypt(confirmed.snapshot,pass);
   }
   verify(pass,gen);
   lastSuccess=Date.now();
   say('Favoritos sincronizados: '+selected.length+'. También estarán disponibles en el otro dispositivo al abrir acceso privado.');
  }catch(error){
   if(gen===generation)say('Sin sincronizar: '+error.message+' Tus favoritos locales se conservan.');
  }finally{
   working=false;button.disabled=false;
   if(again){again=false;if(window.RumboSession?.available())void sync();}
  }
 }
 // Evento solo después de que Rumbo guarde correctamente la estrella en su almacén habitual.
 window.addEventListener('rumbo:favorites-updated',event=>{
  try{
   const e=event.detail;
   if(typeof e?.key!=='string'||typeof e.selected!=='boolean'||e.key.length>1400)return;
   const current=readLocal();
   const map=new Map(current.entries.map(x=>[x.key,x]));
   const at=Date.now(),old=map.get(e.key);
   map.set(e.key,{key:e.key,selected:e.selected,at:Math.max(at,(old?.at||0)+1),nonce:crypto.randomUUID()});
   localStorage.setItem(META,JSON.stringify({version:1,entries:sort(map.values())}));
   if(window.RumboSession?.available())void sync();
   else say('Favorito guardado en este dispositivo. Para verlo también en el móvil, abre Acceso privado en ambos.');
  }catch{say('Favorito guardado localmente, pero la sincronización no pudo prepararse.');}
 });
 window.RumboSession?.subscribe(connected=>{
  generation++;
  if(connected)void sync();
  else{button.hidden=true;say('Favoritos guardados en este dispositivo. Entra en «Acceso privado» para sincronizar entre móvil y ordenador.');}
 });
 button.addEventListener('click',()=>void sync());
 window.addEventListener('online',()=>{if(window.RumboSession?.available())void sync();});
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&window.RumboSession?.available()&&Date.now()-lastSuccess>180000)void sync();
 });
 if(window.RumboSession?.available())void sync();
 else say('Favoritos guardados en este dispositivo. Entra en «Acceso privado» en ambos dispositivos para sincronizarlos.');
})();
