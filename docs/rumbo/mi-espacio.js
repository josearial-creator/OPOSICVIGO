(() => {
'use strict';
const root=document.getElementById('mi-espacio');if(!root)return;
const endpointDefault='https://rumbo-entrenador.jose-arial.workers.dev';
const $=id=>document.getElementById(id), enc=new TextEncoder(),dec=new TextDecoder();
let token='',key=null,notes=[],editing=null,recognition=null,dirty=false;
const mark=t=>{$('esp-status').textContent=t;};
root.innerHTML=`
<div class="esp-header"><div><div class="eyebrow">PERSONAL Y PRIVADO</div><h2>Mi espacio</h2><p>Escribe lo que necesites, sin categorías obligatorias.</p></div></div>
<div class="esp-login">
 <label>Contraseña privada de Rumbo<input id="esp-password" type="password" autocomplete="off" placeholder="Contraseña para acceder a tus anotaciones"></label>
 <button id="esp-connect" class="button primary" type="button">Acceder a mis anotaciones</button>
 <button id="esp-disconnect" class="button secondary" type="button" hidden>Salir</button>
 <p class="assistant-muted">El acceso se comprueba en el servidor. La contraseña permanece en memoria durante esta sesión.</p>
</div>
<div id="esp-private" hidden>
 <label for="esp-text">¿Qué tienes en mente?</label>
 <textarea id="esp-text" rows="8" maxlength="10000" placeholder="¿Qué tienes en mente?"></textarea>
 <div class="esp-actions">
  <button id="esp-save" class="button primary" type="button">Guardar</button>
  <button id="esp-new" class="button secondary" type="button" hidden>Nueva anotación</button>
  <button id="esp-mic" class="button secondary" type="button">Dictar</button>
 </div>
 <p class="assistant-muted" id="esp-draft-status">El borrador se conserva cifrado en este navegador.</p>
 <div id="esp-mood" hidden><span>Si quieres, ¿cómo te encuentras?</span><div class="esp-actions"><button type="button" data-mood="bien" class="button secondary">Bien</button><button type="button" data-mood="regular" class="button secondary">Regular</button><button type="button" data-mood="mal" class="button secondary">Mal</button><button type="button" data-mood="" class="button secondary">Omitir</button></div></div>
 <h3>Anotaciones recientes</h3>
 <div id="esp-list"></div>
 <div class="esp-actions"><button id="esp-export" type="button" class="button secondary">Exportar mis anotaciones</button><button id="esp-delete-all" type="button" class="button secondary">Eliminar todas mis anotaciones</button></div>
</div>
<p id="esp-status" role="status" aria-live="polite"></p>`;
const endpoint=(()=>{try{const s=localStorage.getItem('rumbo-ai-endpoint')||endpointDefault;const u=new URL(s);return u.protocol==='https:'?u.origin:endpointDefault;}catch{return endpointDefault;}
})();
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
const auth=()=> 'Rumbo '+btoa(String.fromCharCode(...enc.encode(token)));
async function api(path='',method='GET',body) {
 const r=await fetch(endpoint+'/notes'+path,{method,headers:{Authorization:auth(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
 let data;try{data=await r.json();}catch{throw Error('El servidor no devolvió una respuesta válida');}
 if(!r.ok)throw Error(data.error||'Error del servidor');
 return data;
}
const bytesTo64=b=>btoa(String.fromCharCode(...new Uint8Array(b))),from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function makeKey(pass,salt){const raw=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:180000,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
let draftWritable=false,saveQueue=Promise.resolve();
function persistDraft(value){
 if(!draftWritable||!key)return Promise.reject(Error('Borrador bloqueado'));
 const sessionKey=key,sessionSalt=activeSalt;
 saveQueue=saveQueue.catch(()=>{}).then(async()=>{
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},sessionKey,enc.encode(value));
  const salt=bytesTo64(sessionSalt);
  localStorage.setItem('rumbo-mi-espacio-draft-v1',JSON.stringify({salt,iv:bytesTo64(iv),cipher:bytesTo64(cipher)}));
 });
 return saveQueue;
}
let activeSalt;
async function unlockDraft() {
 const existing=(()=>{try{return JSON.parse(localStorage.getItem('rumbo-mi-espacio-draft-v1')||'null');}catch{return null;}})();
 activeSalt=existing?.salt?from64(existing.salt):crypto.getRandomValues(new Uint8Array(16));
 key=await makeKey(token,activeSalt);
 if(existing?.iv&&existing?.cipher){
   try{const text=dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(existing.iv)},key,from64(existing.cipher)));$('esp-text').value=text;dirty=!!text;}
   catch {draftWritable=false;mark('El borrador anterior no se pudo recuperar. No se sobrescribirá.');return;}
 }
 draftWritable=true;$('esp-draft-status').textContent='El borrador se conserva cifrado automáticamente.';
}
let timer;
let busy=false;
function lock(value){busy=value;root.querySelectorAll('button,input,textarea').forEach(el=>{el.disabled=value||(el.id==='esp-mic'&&!Recognizer);});}
function stopDictation(){if(recognition){recognition.abort();recognition=null;}$('esp-mic').textContent='Dictar';}
$('esp-text').addEventListener('input',()=>{
 dirty=true;$('esp-new').hidden=true;$('esp-mood').hidden=true;
 clearTimeout(timer);timer=setTimeout(()=>persistDraft($('esp-text').value).then(()=>$('esp-draft-status').textContent='Borrador conservado.').catch(()=>$('esp-draft-status').textContent='No se pudo conservar el borrador; copia el texto antes de salir.'),250);
});
async function load(){const data=await api();notes=data.notes;render();}
function render(){
 const list=$('esp-list');list.replaceChildren();
 if(!notes.length){const p=document.createElement('p');p.textContent='Aún no hay anotaciones.';list.append(p);return;}
 for(const n of notes){
  const card=document.createElement('article');card.className='esp-note';
  const date=document.createElement('time');date.textContent=new Date(n.createdAt).toLocaleString('es-ES');card.append(date);
  const excerpt=document.createElement('p');excerpt.textContent=n.text.length>220?n.text.slice(0,220)+'…':n.text;card.append(excerpt);
  const actions=document.createElement('div');actions.className='esp-actions';
  for(const [name,fn] of [
   ['Abrir',()=>{if(busy||(dirty&&!confirm('¿Descartar los cambios sin guardar?')))return;clearTimeout(timer);editing=n.id;$('esp-text').value=n.text;dirty=false;$('esp-new').hidden=false;$('esp-text').focus();mark('Anotación abierta. Puedes modificarla y guardar.');}],
   ['Editar',()=>{if(busy||(dirty&&!confirm('¿Descartar los cambios sin guardar?')))return;clearTimeout(timer);editing=n.id;$('esp-text').value=n.text;dirty=false;$('esp-new').hidden=false;$('esp-text').focus();}],
   ['Borrar',async()=>{if(!confirm('¿Borrar definitivamente esta anotación?'))return;try{await api('/'+n.id,'DELETE');notes=notes.filter(x=>x.id!==n.id);if(editing===n.id)editing=null;render();mark('Anotación borrada.');}catch(e){mark('No se pudo borrar: '+e.message);}}]
  ]){const btn=document.createElement('button');btn.type='button';btn.className='button secondary';btn.textContent=name;btn.addEventListener('click',fn);actions.append(btn);}
  card.append(actions);list.append(card);
 }
}
$('esp-connect').addEventListener('click',async()=>{
 if(busy)return;
 const pass=$('esp-password').value;
 if(!pass){mark('Introduce la contraseña privada.');return;}
 token=pass;lock(true);
 try{await load();await unlockDraft();$('esp-private').hidden=false;$('esp-disconnect').hidden=false;$('esp-password').value='';mark('Acceso autorizado.');}
 catch(e){token='';mark('No se pudo acceder: '+e.message);}
 finally{lock(false);}
});
$('esp-disconnect').addEventListener('click',async()=>{
 if(busy)return;clearTimeout(timer);stopDictation();lock(true);
 try{if(dirty)await persistDraft($('esp-text').value);await saveQueue;}
 catch{mark('No se pudo conservar el borrador. Copia el texto antes de salir.');lock(false);return;}
 token='';key=null;draftWritable=false;notes=[];editing=null;dirty=false;
 $('esp-list').replaceChildren();$('esp-private').hidden=true;$('esp-disconnect').hidden=true;$('esp-text').value='';mark('Sesión cerrada.');lock(false);
});
$('esp-save').addEventListener('click',async()=>{
 if(busy)return;
 const text=$('esp-text').value;
 if(!text.trim()){mark('Escribe primero una anotación.');return;}
 clearTimeout(timer);stopDictation();lock(true);mark('Guardando anotación…');
 try{
  await persistDraft(text);
  const data=await api(editing?'/'+editing:'',editing?'PUT':'POST',{text});
  editing=data.note.id;dirty=false;
  const index=notes.findIndex(x=>x.id===data.note.id);
  if(index>=0)notes[index]=data.note;else notes.unshift(data.note);
  notes.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));render();
  mark('Anotación guardada');$('esp-new').hidden=false;$('esp-mood').hidden=false;
  await persistDraft('');
  $('esp-draft-status').textContent='Guardada en el servidor privado.';
 }catch(e){mark('No se ha confirmado el guardado: '+e.message+' Conserva el texto y vuelve a intentarlo.');}
 finally{lock(false);}
});
$('esp-new').addEventListener('click',()=>{if(busy||(dirty&&!confirm('¿Descartar los cambios sin guardar?')))return;clearTimeout(timer);dirty=false;editing=null;$('esp-text').value='';$('esp-new').hidden=true;$('esp-mood').hidden=true;persistDraft('').catch(()=>{});$('esp-text').focus();mark('Nueva anotación.');});
$('esp-mood').addEventListener('click',async e=>{
 const mood=e.target.dataset?.mood;if(mood===undefined)return;
 if(!editing){$('esp-mood').hidden=true;return;}
 try{
 const note=notes.find(x=>x.id===editing);if(!note)return;
 const {note:updated}=await api('/'+editing,'PUT',{text:note.text,mood:mood||null});
 notes=notes.map(x=>x.id===updated.id?updated:x);$('esp-mood').hidden=true;mark('Preferencia guardada.');
 }catch(e){mark('No se pudo guardar el estado de ánimo: '+e.message);}
});
$('esp-export').addEventListener('click',()=>{
 const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),notes},null,2)],{type:'application/json'});
 const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='rumbo-mi-espacio.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);
 mark('Exportación preparada. El archivo contiene información personal.');
});
$('esp-delete-all').addEventListener('click',async()=>{
 if(!confirm('¿Eliminar DEFINITIVAMENTE todas tus anotaciones del servidor? Esta operación no se puede deshacer.'))return;
 try{await api('','DELETE');notes=[];editing=null;$('esp-text').value='';$('esp-mood').hidden=true;$('esp-new').hidden=true;await persistDraft('');render();mark('Anotaciones y borrador eliminados.');}
 catch(e){mark('No se pudieron eliminar todas: '+e.message);}
});
const Recognizer=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!Recognizer){$('esp-mic').disabled=true;$('esp-mic').title='Dictado no disponible en este navegador';}
else $('esp-mic').addEventListener('click',()=>{
 if(busy)return;
 if(recognition){recognition.stop();return;}
 const r=new Recognizer();recognition=r;r.lang='es-ES';r.interimResults=false;
 $('esp-mic').textContent='Detener dictado';mark('Micrófono activo. Revisa el texto antes de guardar.');
 r.onresult=e=>{if(!token)return;const t=[...e.results].map(x=>x[0].transcript).join(' ');$('esp-text').value=($('esp-text').value+' '+t).trim();$('esp-text').dispatchEvent(new Event('input'));mark('Dictado terminado. Revisa el texto antes de guardar.');};
 r.onerror=()=>mark('No se pudo transcribir. Puedes escribir manualmente.');
 r.onend=()=>{recognition=null;$('esp-mic').textContent='Dictar';};
 try{r.start();}catch{recognition=null;$('esp-mic').textContent='Dictar';mark('No se pudo activar el micrófono.');}
});
})();