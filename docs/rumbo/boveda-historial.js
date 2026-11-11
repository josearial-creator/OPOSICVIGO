/* Bóveda independiente del diseño: snapshots locales append-only y con comprobación SHA-256.
   IndexedDB no sustituye una copia cifrada fuera de este navegador. */
(() => {
  'use strict';
  const KEY='rumbo-historial-importado-v1';
  const DB='rumbo-boveda-historial-v1';
  const TABLE='snapshots';
  const MAX_RECORDS=5000;
  let sequence=Promise.resolve();
  const empty=()=>({version:1,entries:[]});
  const validRecord=e=>e&&typeof e==='object'&&['reflection','situation','quick'].includes(e.kind)&&typeof e.id==='string'&&e.id.length>0&&e.id.length<=260&&typeof e.date==='string'&&typeof e.title==='string'&&e.payload&&typeof e.payload==='object'&&!Array.isArray(e.payload);
  function validStore(s){return s?.version===1&&Array.isArray(s.entries)&&s.entries.length<=MAX_RECORDS&&s.entries.every(validRecord)&&new Set(s.entries.map(e=>e.id)).size===s.entries.length;}
  function serialize(s){
    if(!validStore(s))throw Error('El archivo del historial tiene un formato incompatible. Ningún dato se ha cambiado.');
    const json=JSON.stringify(s);
    if(json.length>4000000)throw Error('Historial demasiado grande. Conserva tu copia externa.');
    return json;
  }
  function current(){
    const raw=localStorage.getItem(KEY);
    if(raw===null)return empty();
    let parsed;try{parsed=JSON.parse(raw);}catch{throw Error('El historial existente no se puede leer; no se sobrescribirá.');}
    if(!validStore(parsed))throw Error('El historial existente usa un formato incompatible; no se sobrescribirá.');
    return parsed;
  }
  function openDB(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window))return reject(Error('IndexedDB no está disponible en este navegador.'));
      const request=indexedDB.open(DB,1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(TABLE))request.result.createObjectStore(TABLE,{keyPath:'hash'});};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(Error('No se pudo abrir el archivo de seguridad independiente.'));
      request.onblocked=()=>reject(Error('Cierra otras pestañas de Rumbo para acceder al archivo de seguridad.'));
    });
  }
  async function hashJson(json){
    if(!crypto.subtle)throw Error('La verificación de integridad requiere HTTPS.');
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(json));
    return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  async function allSnapshots(){
    const db=await openDB();
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction(TABLE,'readonly'),req=tx.objectStore(TABLE).getAll();
      req.onsuccess=()=>resolve(req.result||[]);
      req.onerror=()=>reject(Error('No se pudieron leer los archivos guardados.'));
      tx.onabort=()=>reject(Error('Lectura del archivo interrumpida.'));
    });}finally{db.close();}
  }
  async function archive(store){
    const json=serialize(store),hash=await hashJson(json);
    const db=await openDB();
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(TABLE,'readwrite',{durability:'strict'}),bucket=tx.objectStore(TABLE);
        const request=bucket.get(hash);
        request.onsuccess=()=>{
          if(!request.result)bucket.add({hash,json,count:store.entries.length,savedAt:new Date().toISOString()});
        };
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(Error('No se pudo archivar una copia de seguridad.'));
        tx.onabort=()=>reject(Error('El navegador interrumpió el archivo de seguridad.'));
      });
    }finally{db.close();}
    return hash;
  }
  async function latest(){
    const snapshots=await allSnapshots();
    if(!snapshots.length)return null;
    snapshots.sort((a,b)=>b.count-a.count||b.savedAt.localeCompare(a.savedAt));
    const snap=snapshots[0];
    if(typeof snap.json!=='string'||typeof snap.hash!=='string'||await hashJson(snap.json)!==snap.hash)throw Error('El archivo guardado no supera la verificación de integridad. Conserva la copia externa.');
    let obj;try{obj=JSON.parse(snap.json);}catch{throw Error('La copia guardada está dañada.');}
    serialize(obj);
    return {store:obj,hash:snap.hash,count:snapshots.length,date:snap.savedAt};
  }
  function union(previous,incoming){
    const merged=new Map(previous.entries.map(e=>[e.id,e]));
    let added=0;
    for(const e of incoming.entries){
      const existing=merged.get(e.id);
      if(existing){
        if(JSON.stringify(existing)!==JSON.stringify(e))throw Error('Hay dos versiones diferentes de un mismo registro. No se ha sustituido ninguna. Exporta ambos historiales antes de resolverlo.');
      }else{merged.set(e.id,e);added++;}
    }
    const result={version:1,entries:[...merged.values()]};
    serialize(result);
    return {result,added};
  }
  async function mergeInternal(incoming,restoring){
    serialize(incoming);
    const before=current();
    const safe=await latest();
    if(before.entries.length===0&&safe?.store.entries.length&&!restoring){
      throw Error('Se ha detectado un historial archivado que no está en la vista. Primero pulsa «Recuperar desde bóveda».');
    }
    const {result,added}=union(before,incoming);
    if(before.entries.length)await archive(before);
    const hash=await archive(result);
    const raw=serialize(result);
    try{localStorage.setItem(KEY,raw);}catch{throw Error('El navegador no pudo actualizar el historial. La copia de seguridad independiente sigue archivada.');}
    if(localStorage.getItem(KEY)!==raw)throw Error('La comprobación del guardado local falló. Revisa el archivo de seguridad.');
    return {store:result,added,total:result.entries.length,hash};
  }
  const serial=fn=>{const task=sequence.then(fn);sequence=task.catch(()=>{});return task;};
  window.RumboHistoryVault=Object.freeze({
    validStore,
    mergeStore:incoming=>serial(()=>mergeInternal(incoming,false)),
    protectCurrent:()=>serial(async()=>{
      const store=current();
      if(store.entries.length)await archive(store);
      return store.entries.length;
    }),
    restore:()=>serial(async()=>{
      const snapshot=await latest();
      if(!snapshot)throw Error('No hay copias locales en la bóveda. Importa el archivo original.');
      return mergeInternal(snapshot.store,true);
    }),
    status:()=>serial(async()=>{
      const snapshot=await latest();
      const currentCount=current().entries.length;
      let persisted=null;
      if(navigator.storage?.persisted){try{persisted=await navigator.storage.persisted();}catch{}}
      return {snapshots:snapshot?.count||0,archived:snapshot?.store.entries.length||0,current:currentCount,hash:snapshot?.hash||null,persisted};
    }),
    requestPersistence:async()=>{
      if(!navigator.storage?.persist)throw Error('El navegador no admite conservación persistente.');
      return navigator.storage.persist();
    }
  });
})();