(() => {
 'use strict';
 // Historial privado: el Worker solo recibe AES-GCM; la clave y el texto nunca salen en claro.
 const root=document.getElementById('historial-rumbo');
 if(!root||!window.RumboHistoryVault)return;
 const API='https://rumbo-entrenador.jose-arial.workers.dev/history';
 const STORE='rumbo-historial-importado-v1',MAX=5000;
 const enc=new TextEncoder(),dec=new TextDecoder(),vault=window.RumboHistoryVault;
 const saltBytes=16,ivBytes=12;
 let busy=false,retry=false,generation=0,lastSuccess=0,lastError=false;
 const panel=document.createElement('section');
 panel.className='historic-cloud';
 panel.innerHTML='<h3>Copia privada sincronizada</h3><p id="historic-cloud-status" role="status" aria-live="polite">Abre «Acceso privado» para conectar tu historial cifrado.</p><p class="historic-cloud-note">Se cifra en este dispositivo antes de enviarse. Se conserva también la copia local y puedes exportar otra. La primera vez importa tu JSON de 132 registros; después se recuperarán al entrar con la misma contraseña.</p><button id="historic-cloud-retry" type="button" class="button secondary">Comprobar sincronización</button>';
 const area=root.querySelector('.historic-vault');
 if(area)area.after(panel);else root.append(panel);
 const status=panel.querySelector('#historic-cloud-status');
 const button=panel.querySelector('#historic-cloud-retry');
 const say=text=>{status.textContent=text;};
 const b64=buffer=>{const bytes=new Uint8Array(buffer);let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out);};
 const from64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
 const hex=buffer=>Array.from(new Uint8Array(buffer),n=>n.toString(16).padStart(2,'0')).join('');
 const hash=text=>crypto.subtle.digest('SHA-256',enc.encode(text)).then(hex);
 const auth=pass=>'Rumbo '+b64(enc.encode(pass));
 const check=(pass,at)=>{if(at!==generation||!window.RumboSession?.available()||window.RumboSession.use()!==pass)throw Error('Sesión cerrada; sincronización detenida.');};
 const validEntry=e=>e&&typeof e==='object'&&['reflection','situation','quick'].includes(e.kind)&&typeof e.id==='string'&&e.id.length>0&&e.id.length<=260&&typeof e.date==='string'&&typeof e.title==='string'&&e.payload&&typeof e.payload==='object'&&!Array.isArray(e.payload);
 function canonical(data){
  if(!data||data.version!==1||!Array.isArray(data.entries)||data.entries.length>MAX||!data.entries.every(validEntry)||new Set(data.entries.map(e=>e.id)).size!==data.entries.length)throw Error('El historial tiene un formato incompatible. No se modificará.');
  return {version:1,entries:[...data.entries].sort((a,b)=>a.id.localeCompare(b.id))};
 }
 function local(){
  const raw=localStorage.getItem(STORE);
  return canonical(raw?JSON.parse(raw):{version:1,entries:[]});
 }
 async function key(pass,salt){
  const master=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},master,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 }
 async function seal(store,pass,id){
  const salt=crypto.getRandomValues(new Uint8Array(saltBytes)),iv=crypto.getRandomValues(new Uint8Array(ivBytes));
  const sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(pass,salt),enc.encode(JSON.stringify(store)));
  return {version:1,id,createdAt:new Date().toISOString(),count:store.entries.length,salt:b64(salt),iv:b64(iv),cipher:b64(sealed)};
 }
 async function open(snapshot,pass){
  if(!snapshot||snapshot.version!==1||!/^[a-f0-9]{64}$/.test(snapshot.id)||typeof snapshot.cipher!=='string')throw Error('Copia remota incompatible; no se ha modificado el historial.');
  const salt=from64(snapshot.salt),iv=from64(snapshot.iv);
  if(salt.length!==saltBytes||iv.length!==ivBytes)throw Error('Copia remota dañada.');
  let plain;
  try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},await key(pass,salt),from64(snapshot.cipher));}
  catch{throw Error('No se puede descifrar una copia remota con esta contraseña. No se ha sustituido ningún dato.');}
  const store=canonical(JSON.parse(dec.decode(plain)));
  if(store.entries.length!==snapshot.count||await hash(JSON.stringify(store))!==snapshot.id)throw Error('La copia remota no supera la comprobación de integridad.');
  return store;
 }
 async function request(path,pass,init={}){
  const response=await fetch(API+path,{method:init.method||'GET',headers:{Authorization:auth(pass),...(init.body?{'Content-Type':'application/json'}:{})},body:init.body?JSON.stringify(init.body):undefined,cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!response.ok){
   if(response.status===404)throw Error('El servidor aún no tiene el archivo privado: debe activarse la sincronización en Cloudflare.');
   if(response.status===401||response.status===403)throw Error('El servidor ha rechazado el acceso. Comprueba la contraseña o la autorización de esta dirección web.');
   if(response.status===409)throw Error('Otra copia ya utiliza este identificador.');
   throw Error('Servidor privado no disponible (HTTP '+response.status+'). Los registros locales se mantienen.');
  }
  return response.json();
 }
 async function getVersions(pass,at){
  const found=new Map();let cursor=null;
  for(let i=0;i<100;i++){
   check(pass,at);
   const data=await request(cursor?'?cursor='+encodeURIComponent(cursor):'',pass);
   if(!Array.isArray(data.versions))throw Error('Respuesta remota incompatible.');
   for(const v of data.versions){if(!/^[a-f0-9]{64}$/.test(v.id))throw Error('Identificador remoto no válido.');found.set(v.id,v);}
   if(!data.cursor)return found;
   if(typeof data.cursor!=='string'||data.cursor===cursor)throw Error('Paginación remota inválida.');
   cursor=data.cursor;
  }
  throw Error('Demasiadas copias remotas; no se modifica ninguna.');
 }
 async function sync(){
  if(!window.RumboSession?.available()){say('Abre «Acceso privado» para recuperar o guardar tu historial cifrado.');return;}
  if(busy){retry=true;return;}
  const pass=window.RumboSession.use(),at=generation;
  busy=true;lastError=false;button.disabled=true;
  try{
   if(!crypto?.subtle)throw Error('La conexión cifrada requiere HTTPS.');
   say('Comprobando el historial privado…');
   const versions=await getVersions(pass,at),remotes=[];
   for(const id of versions.keys()){
    check(pass,at);
    const item=await request('/'+id,pass);
    const store=await open(item.snapshot,pass);
    remotes.push(...store.entries);
    if(remotes.length>500000)throw Error('Demasiadas versiones para restaurar automáticamente.');
   }
   check(pass,at);
   const unique=new Map();
   for(const entry of remotes){
    const old=unique.get(entry.id);
    if(old&&JSON.stringify(old)!==JSON.stringify(entry))throw Error('Conflicto entre copias remotas. No se ha sustituido ningún registro.');
    unique.set(entry.id,entry);
   }
   if(unique.size){
    const result=await vault.mergeStore({version:1,entries:[...unique.values()]});
    check(pass,at);
    if(result.added)window.dispatchEvent(new Event('rumbo:historial-recuperado'));
   }
   const store=local();
   if(!store.entries.length){say('El archivo remoto está vacío. Importa una vez tu JSON de 132 registros para crear la copia privada.');return;}
   const id=await hash(JSON.stringify(store));
   check(pass,at);
   if(!versions.has(id)){
    say('Guardando '+store.entries.length+' registros cifrados en el servidor…');
    const sealed=await seal(store,pass,id);
    check(pass,at);
    try{await request('',pass,{method:'POST',body:sealed});}
    catch(e){
     if(!/identificador/.test(e.message))throw e;
     const existing=(await request('/'+id,pass)).snapshot;
     await open(existing,pass); // Reintento idéntico: comprobar antes de aceptarlo.
    }
    check(pass,at);
    const confirmed=(await request('/'+id,pass)).snapshot;
    await open(confirmed,pass);
    say('Copia cifrada confirmada: '+store.entries.length+' registros guardados en Cloudflare. Se recuperarán al iniciar sesión en otro dispositivo.');
   }else say('Historial sincronizado: '+store.entries.length+' registros protegidos en Cloudflare.');
   lastSuccess=Date.now();
  }catch(e){
   if(at===generation){lastError=true;say('Sincronización no completada: '+e.message+' Conserva el JSON original; no se han borrado registros.');}
  }finally{
   busy=false;button.disabled=false;
   if(retry){retry=false;if(window.RumboSession?.available())void sync();}
  }
 }
 button.addEventListener('click',()=>void sync());
 window.RumboSession?.subscribe(connected=>{
  generation++;
  if(connected){void sync();}
  else{retry=false;say('Acceso cerrado. El archivo remoto permanece cifrado; tus copias locales no se han eliminado.');}
 });
 window.addEventListener('rumbo:historial-actualizado',()=>{if(window.RumboSession?.available())void sync();});
 window.RumboHistoryCloud=Object.freeze({sync,status:()=>({connected:Boolean(window.RumboSession?.available()),pending:busy,lastSuccess,error:lastError})});
 if(window.RumboSession?.available())void sync();
})();
