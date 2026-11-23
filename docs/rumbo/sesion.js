(() => {
 'use strict';
 const API='https://rumbo-entrenador.jose-arial.workers.dev';
 const device=window.RumboRemember;
 let credential='',generation=0,remembered=false,storageError='',restoring=true;
 let pending=Promise.resolve();
 const listeners=new Set();
 const button=document.getElementById('rumbo-access-open');
 const dialog=document.getElementById('rumbo-access-dialog');
 const form=document.getElementById('rumbo-access-form');
 const input=document.getElementById('rumbo-access-password');
 const submit=document.getElementById('rumbo-access-submit');
 const status=document.getElementById('rumbo-access-status');
 const intro=document.getElementById('rumbo-access-credentials');
 const opened=document.getElementById('rumbo-access-connected');
 const close=document.getElementById('rumbo-access-close');
 const logout=document.getElementById('rumbo-access-logout');
 const settingsLogout=document.getElementById('rumbo-settings-logout');
 const settingsState=document.getElementById('rumbo-settings-session-state');
 function renderAccess(){
  if(!button||!dialog)return;
  button.textContent=credential?'Acceso abierto':restoring?'Recuperando acceso…':'Acceso privado';
  button.setAttribute('aria-label',credential?'Acceso privado abierto. Opciones de sesión.':'Abrir acceso privado a Rumbo');
  button.setAttribute('data-connected',credential?'true':'false');
  intro.hidden=Boolean(credential);opened.hidden=!credential;
  if(settingsLogout)settingsLogout.hidden=!credential;
  if(settingsState)settingsState.textContent=credential?
   (remembered?'Acceso recordado en este dispositivo.':'Acceso abierto en esta pestaña.'+(storageError?' '+storageError:'')):
   (restoring?'Comprobando acceso recordado…':'Sesión privada cerrada.');
 }
 function notify(){
  for(const fn of listeners){try{fn(Boolean(credential));}catch{}}
  renderAccess();
 }
 function persist(value,attempt){
  const work=pending.catch(()=>{}).then(async()=>{
   if(attempt!==generation)return false;
   if(!device)throw Error('Este navegador no permite recordar el acceso.');
   await device.remember(value);
   if(attempt!==generation)return false; // Nunca reactivar después de cerrar sesión.
   device.activate();
   remembered=true;storageError='';renderAccess();
   return true;
  });
  pending=work;
  return work.catch(e=>{
   if(attempt===generation){
    remembered=false;storageError='No se pudo recordar el acceso: '+e.message;
    renderAccess();
   }
   return false;
  });
 }
 function unlock(value){
  if(typeof value!=='string'||!value)return false;
  const attempt=++generation;
  credential=value;remembered=false;notify();
  void persist(value,attempt);
  return true;
 }
 function lockFromAnotherTab(){
  generation++;credential='';remembered=false;storageError='';
  notify();
 }
 function lock(){
  lockFromAnotherTab();
  try{device?.markRevoked();}catch{}
  const work=pending.catch(()=>{}).then(()=>device?.revoke());
  pending=work;
  work.catch(e=>{storageError='No se pudo borrar el acceso guardado: '+e.message;renderAccess();});
  return work;
 }
 async function signIn(value,{restored=false}={}){
  if(typeof value!=='string'||!value||value.length>4096)throw Error('Introduce una contraseña válida.');
  const attempt=++generation;
  const auth='Rumbo '+btoa(String.fromCharCode(...new TextEncoder().encode(value)));
  let result;
  try{
   result=await fetch(API+'/notes',{method:'GET',headers:{Authorization:auth},cache:'no-store',signal:AbortSignal.timeout(15000)});
  }catch(error){
   // Un rechazo CORS puede llegar como TypeError sin respuesta HTTP legible.
   // No afirmamos la causa ni mostramos contraseñas, cabeceras o tokens.
   const preview=window.self!==window.top;
   const timeout=error?.name==='TimeoutError';
   throw Error(timeout
    ?'El servidor privado no respondió a tiempo. Comprueba la conexión y vuelve a probar desde el dominio habitual.'
    :preview
     ?'No se pudo conectar desde esta vista previa. Podría ser una restricción del dominio (CORS) o de red. Abre Rumbo desde su dirección habitual para acceder a tus datos privados.'
     :'No se pudo contactar con el servidor privado. Comprueba la conexión y, si persiste, revisa el estado del servidor.');
  }
  if(!result.ok){
   if(result.status===401)throw Error('Contraseña incorrecta o sesión revocada.');
   if(result.status===403)throw Error('Esta dirección web no está autorizada por el servidor privado.');
   throw Error('El servidor no pudo validar el acceso (HTTP '+result.status+').');
  }
  const data=await result.json().catch(()=>null);
  if(!data||!Array.isArray(data.notes))throw Error('No se ha podido validar la respuesta privada.');
  if(attempt!==generation)return false;
  credential=value;remembered=restored;storageError='';notify();
  if(!restored)await persist(value,attempt);
  if(attempt!==generation)return false;
  return true;
 }
 async function signOut(){
  // No perder textos ABCD que todavía no se han guardado.
  const fields=[...document.querySelectorAll('#er-form textarea')];
  if(fields.some(e=>e.value.trim())&&!confirm('El entrenamiento que estás escribiendo no se ha guardado. ¿Cerrar sesión y descartarlo?'))return false;
  // La rutina de Mi espacio protege y guarda primero el borrador cifrado.
  const safe=window.RumboPrivateSpace?.close;
  if(typeof safe==='function'){
   const ok=await safe();
   if(!ok)return false;
  }
  if(credential)await lock();
  else await pending.catch(()=>{});
  if(dialog?.open)dialog.close();
  return true;
 }
 window.RumboSession=Object.freeze({
  available:()=>Boolean(credential),use:()=>credential,unlock,lock,signIn,signOut,
  remembered:()=>Boolean(remembered),storageError:()=>storageError,
  subscribe(fn){if(typeof fn!=='function')return ()=>{};listeners.add(fn);return ()=>listeners.delete(fn);}
 });
 window.addEventListener('storage',event=>{
  if(event.key===device?.revokedKey&&event.newValue)lockFromAnotherTab();
 });
 button?.addEventListener('click',()=>{
  renderAccess();status.textContent='';
  dialog.showModal();
  if(!credential)input.focus();
 });
 close?.addEventListener('click',()=>dialog.close());
 dialog?.addEventListener('close',()=>{input.value='';status.textContent='';});
 form?.addEventListener('submit',async e=>{
  e.preventDefault();if(submit.disabled)return;
  const value=input.value;input.value='';
  submit.disabled=true;status.textContent='Comprobando acceso…';
  try{
   const accepted=await signIn(value);
   if(accepted){
    status.textContent=remembered?'Acceso autorizado y recordado en este dispositivo.':'Acceso autorizado. '+storageError;
    dialog.close();
   }else status.textContent='La conexión se canceló.';
  }catch(err){status.textContent=err.message;}
  finally{submit.disabled=false;}
 });
 logout?.addEventListener('click',()=>{void signOut();});
 // La restauración siempre se valida con Cloudflare. Una caída de red
 // no borra la credencial cifrada; al recuperar conexión se puede reintentar.
 async function restore(){
  const at=generation;
  try{
   const password=await device?.restore();
   if(at!==generation||!password)return;
   await signIn(password,{restored:true});
  }catch(err){
   if(at===generation){storageError='Acceso recordado no disponible: '+err.message;}
  }finally{restoring=false;renderAccess();}
 }
 window.addEventListener('online',()=>{if(!credential&&!restoring)void restore();});
 renderAccess();
 void restore();
})();
