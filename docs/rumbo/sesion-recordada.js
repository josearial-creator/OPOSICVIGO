(() => {
 'use strict';
 // Credencial cifrada en el dispositivo. La CryptoKey AES-GCM NO es exportable
 // y se guarda por separado de la clave maestra del servidor.
 // Esto NO equivale a una cookie HttpOnly: quien use este perfil del navegador
 // puede acceder sin contraseña. No usar en dispositivos compartidos.
 const DB='rumbo-dispositivo-privado-v1',STORE='credencial',REVOKED='rumbo-acceso-revocado-v1';
 const enc=new TextEncoder(),dec=new TextDecoder();
 const open=()=>new Promise((resolve,reject)=>{
   if(!globalThis.indexedDB) return reject(Error('Este navegador no admite acceso recordado.'));
   const request=indexedDB.open(DB,1);
   request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error||Error('No se puede abrir el almacén privado.'));
   request.onblocked=()=>reject(Error('Otra pestaña bloquea la actualización del almacén.'));
 });
 async function read(){
   const db=await open();
   try {
     return await new Promise((resolve,reject)=>{
       const tx=db.transaction(STORE,'readonly'),store=tx.objectStore(STORE);
       const key=store.get('key'),record=store.get('record');
       tx.oncomplete=()=>resolve({key:key.result,record:record.result});
       tx.onerror=()=>reject(tx.error||Error('No se pudo leer el acceso recordado.'));
       tx.onabort=()=>reject(tx.error||Error('La lectura del acceso recordado se interrumpió.'));
     });
   } finally {db.close();}
 }
 async function write(key,record){
   const db=await open();
   try{
     await new Promise((resolve,reject)=>{
       const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
       store.put(key,'key');store.put(record,'record');
       tx.oncomplete=resolve;
       tx.onerror=()=>reject(tx.error||Error('No se pudo conservar el acceso.'));
       tx.onabort=()=>reject(tx.error||Error('El guardado del acceso se interrumpió.'));
     });
   }finally{db.close();}
 }
 async function clear(){
   const db=await open();
   try{
     await new Promise((resolve,reject)=>{
       const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
       store.delete('key');store.delete('record');
       tx.oncomplete=resolve;
       tx.onerror=()=>reject(tx.error||Error('No se pudo borrar el acceso recordado.'));
       tx.onabort=()=>reject(tx.error||Error('No se pudo completar el cierre de acceso.'));
     });
   }finally{db.close();}
 }
 async function remember(pass){
   if(typeof pass!=='string'||!pass)throw Error('No hay credencial validada.');
   const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
   const iv=crypto.getRandomValues(new Uint8Array(12));
   const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(pass));
   await write(key,{version:1,iv:Array.from(iv),cipher:Array.from(new Uint8Array(cipher))});
 }
 async function restore(){
   if(localStorage.getItem(REVOKED))return null;
   const {key,record}=await read();
   if(!key||!record)return null;
   if(record.version!==1||!Array.isArray(record.iv)||record.iv.length!==12||
      !Array.isArray(record.cipher)||record.cipher.length>8192)return null;
   const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(record.iv)},key,new Uint8Array(record.cipher));
   const pass=dec.decode(plain);
   return pass.length>0&&pass.length<=4096?pass:null;
 }
 function markRevoked(){localStorage.setItem(REVOKED,crypto.randomUUID());}
 function activate(){localStorage.removeItem(REVOKED);}
 function revoke(){
   // Barrera SINCRÓNICA: aunque se recargue mientras IndexedDB borra,
   // una sesión revocada nunca se restaura automáticamente.
   markRevoked();
   return clear();
 }
 window.RumboRemember=Object.freeze({remember,restore,revoke,markRevoked,activate,revokedKey:REVOKED});
})();
