(() => {
 'use strict';
 // Contraseña verificada en el Worker y compartida solo en memoria de esta pestaña.
 const API='https://rumbo-entrenador.jose-arial.workers.dev';
 let credential='',generation=0;
 const listeners=new Set();
 const notify=()=>{
  for(const fn of listeners){try{fn(Boolean(credential));}catch{}}
  renderAccess();
 };
 function unlock(value){
  if(typeof value!=='string'||!value)return false;
  generation++;credential=value;notify();return true;
 }
 function lock(){generation++;credential='';notify();}
 async function signIn(value){
  if(typeof value!=='string'||!value||value.length>4096)throw Error('Introduce una contraseña válida.');
  const attempt=++generation;
  const auth='Rumbo '+btoa(String.fromCharCode(...new TextEncoder().encode(value)));
  let result;
  try{
   result=await fetch(API+'/notes',{method:'GET',headers:{Authorization:auth},cache:'no-store',signal:AbortSignal.timeout(15000)});
  }catch{throw Error('No se pudo contactar con el servidor privado. Comprueba la conexión y que estés en la dirección oficial de Rumbo.');}
  if(!result.ok){
   if(result.status===401)throw Error('Contraseña incorrecta. No se ha abierto el acceso.');
   if(result.status===403)throw Error('Esta dirección web no está autorizada por el servidor privado. No significa que tu contraseña sea incorrecta.');
   throw Error('El servidor no pudo validar el acceso (HTTP '+result.status+'). No se ha abierto la sesión.');
  }
  const data=await result.json().catch(()=>null);
  if(!data||!Array.isArray(data.notes))throw Error('El servidor no devolvió una validación reconocible.');
  if(attempt!==generation)return false;
  credential=value;notify();return true;
 }
 window.RumboSession=Object.freeze({
  available:()=>Boolean(credential),use:()=>credential,unlock,lock,signIn,
  subscribe(fn){if(typeof fn!=='function')return ()=>{};listeners.add(fn);return ()=>listeners.delete(fn);}
 });
 const button=document.getElementById('rumbo-access-open');
 const dialog=document.getElementById('rumbo-access-dialog');
 if(!button||!dialog)return;
 const form=document.getElementById('rumbo-access-form');
 const input=document.getElementById('rumbo-access-password');
 const submit=document.getElementById('rumbo-access-submit');
 const status=document.getElementById('rumbo-access-status');
 const intro=document.getElementById('rumbo-access-credentials');
 const opened=document.getElementById('rumbo-access-connected');
 const close=document.getElementById('rumbo-access-close');
 const logout=document.getElementById('rumbo-access-logout');
 function renderAccess(){
  button.textContent=credential?'Acceso abierto':'Acceso privado';
  button.setAttribute('aria-label',credential?'Acceso privado abierto. Ver opciones de cierre.':'Abrir acceso privado a Rumbo');
  button.setAttribute('data-connected',credential?'true':'false');
  intro.hidden=Boolean(credential);opened.hidden=!credential;
 }
 button.addEventListener('click',()=>{
  renderAccess();status.textContent='';
  dialog.showModal();
  if(!credential)input.focus();
 });
 close.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{input.value='';status.textContent='';});
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(submit.disabled)return;
  const value=input.value;input.value='';
  submit.disabled=true;status.textContent='Comprobando acceso…';
  try{
   if(await signIn(value)){status.textContent='Acceso autorizado para esta pestaña.';dialog.close();}
   else status.textContent='La conexión se canceló.';
  }catch(err){status.textContent=err.message;}
  finally{submit.disabled=false;}
 });
 logout.addEventListener('click',()=>{
  // Preguntar antes de descartar campos ABCD incluso si Mi espacio también está conectado.
  const fields=[...document.querySelectorAll('#er-form textarea')];
  if(fields.some(e=>e.value.trim())&&!confirm('El registro de entrenamiento que estás escribiendo no se ha guardado. ¿Cerrar acceso y descartar ese texto?'))return;
  const disconnect=document.getElementById('esp-disconnect');
  if(disconnect&&!disconnect.hidden&&!disconnect.disabled){dialog.close();disconnect.click();return;}
  lock();status.textContent='Acceso privado cerrado en esta pestaña.';dialog.close();
 });
 renderAccess();
})();
