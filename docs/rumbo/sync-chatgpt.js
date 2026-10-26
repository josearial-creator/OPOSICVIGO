(() => {
  'use strict';
  // Rumbo <-> ChatGPT: bandeja cifrada. Nunca se suben notas en texto claro.
  const INBOX='https://raw.githubusercontent.com/josearial-creator/OPOSICVIGO/main/docs/rumbo-sync/inbox.json';
  const STORE='rumbo-evolucion-v1', DB='rumbo-chatgpt-keys-v1';
  const root=document.getElementById('rumbo-chatgpt-sync');
  if(!root) return;
  const $=id=>root.querySelector('#'+id);
  const enc=new TextEncoder(), dec=new TextDecoder();
  const base64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
  const unbase64=str=>Uint8Array.from(atob(str),c=>c.charCodeAt(0));
  const b64array=buffer=>base64(new Uint8Array(buffer));
  const rsa={name:'RSA-OAEP',hash:'SHA-256'};
  const state={publicBlob:null,key:null,busy:false};
  function message(s,error=false){const e=$('rs-status');e.textContent=s;e.setAttribute('role','status');e.classList.toggle('rs-error',error);}
  function openDB(){return new Promise((resolve,reject)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>q.result.createObjectStore('keys');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
  async function readKey(){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('keys','readonly'),q=tx.objectStore('keys').get('active');q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error);tx.oncomplete=()=>db.close();});}
  async function writeKey(value){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('keys','readwrite');tx.objectStore('keys').put(value,'active');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
  async function fingerprint(spki){const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',spki));return Array.from(hash.slice(0,12),x=>x.toString(16).padStart(2,'0')).join('');}
  async function deriveKey(password,salt){const base=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
  function download(filename,obj){const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function publicText(key){return JSON.stringify({type:'rumbo-sync-public-key',version:1,keyId:key.keyId,spki:key.publicSpki});}
  function showKey(key){state.key=key;state.publicBlob=publicText(key);$('rs-public').value=state.publicBlob;$('rs-pair').hidden=true;$('rs-active').hidden=false;$('rs-id').textContent=key.keyId;message('Clave local disponible. Comparte solo la clave pública con ChatGPT.');}
  async function generate(){
    if(state.busy)return;
    const pass=$('rs-pass').value;
    if(pass.length<12){message('Elige una frase de recuperación de al menos 12 caracteres.',true);return;}
    state.busy=true;$('rs-generate').disabled=true;
    try{
      if(await readKey())throw Error('Ya hay una clave vinculada. No se ha sustituido.');
      message('Generando tu clave privada en este dispositivo...');
      const pair=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:3072,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
      const spki=await crypto.subtle.exportKey('spki',pair.publicKey),der=await crypto.subtle.exportKey('pkcs8',pair.privateKey);
      const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
      const backupKey=await deriveKey(pass,salt),sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv},backupKey,der);
      const keyId=await fingerprint(spki),publicSpki=b64array(spki);
      const backup={type:'rumbo-sync-recovery',version:1,keyId,publicSpki,salt:base64(salt),iv:base64(iv),encryptedPrivate:b64array(sealed)};
      // Solo una CryptoKey no exportable permanece en IndexedDB. La copia descargada va cifrada.
      const privateKey=await crypto.subtle.importKey('pkcs8',der,rsa,false,['decrypt']);
      await writeKey({keyId,publicSpki,privateKey,backup});
      $('rs-pass').value='';
      showKey({keyId,publicSpki,privateKey,backup});
      download('rumbo-recuperacion-'+keyId+'.json',backup);
      message('Clave creada. Guarda el archivo de recuperación y su frase por separado. Copia la clave pública para ChatGPT.');
    }catch(e){message('No se pudo crear la conexión: '+e.message,true);}
    finally{state.busy=false;$('rs-generate').disabled=false;}
  }
  async function restore(){
    if(state.busy)return;
    const file=$('rs-file').files[0],pass=$('rs-restore-pass').value;
    if(!file||pass.length<12){message('Elige tu archivo de recuperación y escribe su frase.',true);return;}
    state.busy=true;
    try{
      if(file.size>15000)throw Error('Archivo demasiado grande.');
      const b=JSON.parse(await file.text());
      if(b.type!=='rumbo-sync-recovery'||b.version!==1||!['salt','iv','encryptedPrivate','publicSpki','keyId'].every(k=>typeof b[k]==='string'))throw Error('Formato de copia incompatible.');
      const salt=unbase64(b.salt),iv=unbase64(b.iv);
      if(salt.length!==16||iv.length!==12)throw Error('Copia no válida.');
      const k=await deriveKey(pass,salt),der=await crypto.subtle.decrypt({name:'AES-GCM',iv},k,unbase64(b.encryptedPrivate));
      const spki=unbase64(b.publicSpki);
      if(await fingerprint(spki)!==b.keyId)throw Error('Identificador de clave incorrecto.');
      const privateKey=await crypto.subtle.importKey('pkcs8',der,rsa,false,['decrypt']);
      // Comprobar la correspondencia de clave pública/privada antes de sustituir nada.
      const publicKey=await crypto.subtle.importKey('spki',spki,rsa,false,['encrypt']);
      const probe=enc.encode('Rumbo: prueba de clave'),cipher=await crypto.subtle.encrypt({name:'RSA-OAEP'},publicKey,probe);
      if(dec.decode(await crypto.subtle.decrypt({name:'RSA-OAEP'},privateKey,cipher))!=='Rumbo: prueba de clave')throw Error('La clave no coincide.');
      const old=await readKey();
      if(old&&old.keyId!==b.keyId){message('Ya existe otra clave. No se ha sustituido para evitar perder acceso a notas antiguas.',true);return;}
      await writeKey({keyId:b.keyId,publicSpki:b.publicSpki,privateKey,backup:b});
      $('rs-restore-pass').value='';showKey({keyId:b.keyId,publicSpki:b.publicSpki,privateKey,backup:b});message('Clave restaurada. Ya puedes incorporar tus registros cifrados.');
    }catch(e){message('No se pudo restaurar (¿frase o archivo incorrectos?): '+e.message,true);}
    finally{state.busy=false;}
  }
  function validNote(note,id){return note&&note.id===id&&typeof note.date==='string'&&/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(note.date)&&!Number.isNaN(Date.parse(note.date))&&['context','response','felt','improve'].every(k=>typeof note[k]==='string'&&note[k].length<=6000)&&note.context.trim().length>0;}
  async function decrypt(item,key){
    if(!item||item.keyId!==key.keyId||typeof item.id!=='string'||!/^[a-zA-Z0-9_-]{8,70}$/.test(item.id))throw Error('Registro no autorizado para esta clave.');
    if(!['wrappedKey','iv','ciphertext'].every(k=>typeof item[k]==='string'))throw Error('Registro cifrado incompleto.');
    const raw=await crypto.subtle.decrypt({name:'RSA-OAEP'},key.privateKey,unbase64(item.wrappedKey));
    const aes=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['decrypt']),iv=unbase64(item.iv);
    if(iv.length!==12)throw Error('IV incorrecto.');
    const body=await crypto.subtle.decrypt({name:'AES-GCM',iv},aes,unbase64(item.ciphertext));
    const note=JSON.parse(dec.decode(body));
    if(!validNote(note,item.id))throw Error('Nota descifrada con formato incompatible.');
    return {id:'chatgpt-'+item.id,date:note.date,context:note.context,response:note.response,felt:note.felt,improve:note.improve};
  }
  async function sync(automatic=false){
    if(state.busy||!state.key)return;
    state.busy=true;$('rs-fetch').disabled=true;
    try{
      if(!automatic)message('Buscando registros cifrados...');
      const req=await fetch(INBOX+'?t='+Date.now(),{cache:'no-store'});
      if(!req.ok)throw Error('No se pudo consultar GitHub ('+req.status+').');
      const inbox=await req.json();
      if(inbox.version!==1||!Array.isArray(inbox.items)||inbox.items.length>2000)throw Error('La bandeja tiene un formato no admitido.');
      const raw=localStorage.getItem(STORE),data=raw?JSON.parse(raw):null;
      if(!data||data.version!==1||!Array.isArray(data.real)||!Array.isArray(data.sessions)||!Array.isArray(data.goals))throw Error('El diario local no está disponible o es incompatible. Exporta primero tus datos.');
      const existing=new Set(data.real.map(x=>x.id)),added=[];
      for(const item of inbox.items){
        if(item.keyId!==state.key.keyId)continue;
        const externalId='chatgpt-'+item.id;
        if(existing.has(externalId))continue;
        const note=await decrypt(item,state.key);
        added.push(note);existing.add(externalId);
      }
      if(added.length){
        data.real.push(...added);
        localStorage.setItem(STORE,JSON.stringify(data)); // Escribe primero, recarga solo tras confirmar.
        message('Incorporados '+added.length+' registros. Actualizando el diario...');
        location.reload();
      }else if(!automatic)message('Todo actualizado: no hay registros nuevos para esta clave.');
    }catch(e){message('No se ha modificado tu diario: '+e.message,true);}
    finally{state.busy=false;$('rs-fetch').disabled=false;}
  }
  root.innerHTML='<h3>Conexión privada con ChatGPT</h3>'+
   '<p>Permite recibir en el diario los registros que pidas guardar desde ChatGPT, sin publicar su contenido. Primero vincula este dispositivo una sola vez.</p>'+
   '<div id="rs-pair"><label>Frase para la copia de recuperación (mínimo 12 caracteres)<input id="rs-pass" type="password" autocomplete="new-password" placeholder="Guárdala en un lugar seguro"></label> <button type="button" class="button primary" id="rs-generate">Crear vínculo seguro</button>'+
   '<details><summary>Ya tengo una copia de recuperación</summary><label>Archivo cifrado <input type="file" id="rs-file" accept=".json,application/json"></label><label>Frase de recuperación <input type="password" id="rs-restore-pass" autocomplete="off"></label> <button type="button" class="button secondary" id="rs-restore">Restaurar clave</button></details></div>'+
   '<div id="rs-active" hidden><p>Vinculación local: <code id="rs-id"></code></p><label>Clave pública (puedes compartirla; nunca envíes la copia de recuperación)<textarea id="rs-public" readonly rows="4" spellcheck="false"></textarea></label><div class="rs-actions"><button type="button" class="button secondary" id="rs-copy">Copiar clave pública</button><button type="button" class="button secondary" id="rs-backup">Descargar copia de recuperación</button><button type="button" class="button primary" id="rs-fetch">Incorporar registros de ChatGPT</button></div></div>'+
   '<p id="rs-status" role="status">Comprobando claves de este dispositivo...</p>'+
   '<p class="rs-privacy">La bandeja de GitHub es pública pero contiene únicamente datos cifrados; la actividad y el número de registros pueden ser visibles. La clave privada permanece en este dispositivo y la copia descargable está cifrada. No se sincroniza el resto de tu diario.</p>';
  $('rs-generate').addEventListener('click',generate);
  $('rs-restore').addEventListener('click',restore);
  $('rs-fetch').addEventListener('click',()=>sync(false));
  $('rs-backup').addEventListener('click',()=>{if(!state.key?.backup){message('No hay copia disponible: usa la copia descargada al crear la clave.',true);return;}download('rumbo-recuperacion-'+state.key.keyId+'.json',state.key.backup);message('Copia cifrada descargada. Guarda la frase por separado.');});
  $('rs-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(state.publicBlob);message('Clave pública copiada. Pégala en ChatGPT para terminar la vinculación.');}catch{ $('rs-public').focus();$('rs-public').select();message('Selecciona el texto y usa Copiar.');}});
  (async()=>{try{
    if(!window.isSecureContext||!crypto?.subtle||!window.indexedDB)throw Error('Se requiere HTTPS y un navegador compatible.');
    const key=await readKey();if(key){showKey(key);await sync(true);}else message('Todavía no está vinculado. Crea una clave para conectar este dispositivo.');
  }catch(e){message('No se pudo iniciar la conexión: '+e.message,true);}})();
})();