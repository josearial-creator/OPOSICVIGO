(() => {
 'use strict';
 const open=document.getElementById('rumbo-settings-open');
 const dialog=document.getElementById('rumbo-settings-dialog');
 if(!open||!dialog)return;
 const close=document.getElementById('rumbo-settings-close');
 // El formulario de ChatGPT es un único nodo: moverlo mantiene sus claves IndexedDB,
 // sus listeners de cifrado y la importación sin crear un segundo formulario.
 const chatSection=document.getElementById('rumbo-chatgpt-sync');
 const chatHost=document.getElementById('rumbo-settings-chatgpt-host');
 const chatDetails=document.getElementById('rumbo-settings-chatgpt');
 if(chatSection&&chatHost&&chatDetails){
   chatSection.removeAttribute('data-mobile-screen');
   chatSection.classList.remove('panel','rumbo-section-hidden');
   chatSection.classList.add('rumbo-settings-chatgpt-panel');
   chatHost.append(chatSection);
 }
 const openChat=()=>{
   if(!chatDetails||!chatSection)return;
   if(document.getElementById('control-chat-host')?.contains(chatSection)){if(dialog.open)dialog.close();window.RumboNavigation?.go('panel-control');document.getElementById('control-chat-details').open=true;return;}
   if(!dialog.open)dialog.showModal();
   chatDetails.open=true;
   chatDetails.scrollIntoView({block:'nearest',behavior:'auto'});
   chatDetails.querySelector('summary')?.focus({preventScroll:true});
 };
 const status=document.getElementById('rumbo-settings-status');
 const say=value=>{if(status)status.textContent=value;};
 const navigate=route=>{
   if(route!=='historial-rumbo')delete document.body.dataset.rumboMaintenance;
   dialog.close();
   if(!window.RumboNavigation?.go(route))location.hash=route;
 };
 // El importador histórico conserva su aviso legible aunque los controles
 // técnicos estén ocultos en la vista normal.
 const history=document.getElementById('historial-rumbo');
 const historicStatus=document.getElementById('historic-status');
 const metrics=history?.querySelector('.historic-metrics');
 if(metrics&&historicStatus)metrics.after(historicStatus);
 // Esconder también la etiqueta del selector de archivos, no solo el input.
 for(const id of ['org-import','ps-import','ev-import','assistant-import']){
   document.getElementById(id)?.closest('label')?.classList.add('rumbo-technical-hidden');
 }
 const files={
   'import-file':'convocatorias',
   'history-home-file':'historial-rumbo',
   'org-import':'proyectos',
   'ps-import':'mi-evolucion',
   'ev-import':'mi-evolucion',
   'assistant-import':'productividad'
 };
 const actions=new Set(['export','historic-export','org-export','study-export','esp-export','ps-export','ev-export','assistant-export-json','assistant-export-csv','er-export']);
 open.addEventListener('click',()=>{
   say('');
   dialog.showModal();
   close.focus();
 });
 const clearChatSecrets=()=>{
   // No conservar frases de recuperación en campos cuando se cierra Ajustes.
   for(const id of ['rs-pass','rs-restore-pass']){const field=document.getElementById(id);if(field)field.value='';}
 };
 close.addEventListener('click',()=>{clearChatSecrets();dialog.close();});
 dialog.addEventListener('close',clearChatSecrets);
 const logout=document.getElementById('rumbo-settings-logout');
 logout?.addEventListener('click',async()=>{
   if(logout.disabled)return;
   logout.disabled=true;say('Cerrando acceso privado y conservando los borradores…');
   try{
     if(await window.RumboSession?.signOut()){
       say('Sesión cerrada en este navegador.');
       dialog.close();
     }else say('Cierre cancelado. Conserva los cambios pendientes antes de salir.');
   }catch(error){say('No se pudo completar el cierre: '+error.message);}
   finally{logout.disabled=false;}
 });
 dialog.addEventListener('click',event=>{
   if(event.target===dialog)dialog.close();
 });
 dialog.addEventListener('click',event=>{
   const chatButton=event.target.closest('[data-settings-chatgpt]');
   if(chatButton&&dialog.contains(chatButton)){openChat();return;}
   const routeButton=event.target.closest('[data-settings-route]');
   if(routeButton&&dialog.contains(routeButton)){
     navigate(routeButton.dataset.settingsRoute);
     return;
   }
   const historyButton=event.target.closest('[data-settings-history]');
   if(historyButton&&dialog.contains(historyButton)){
     navigate('historial-rumbo');
     document.body.dataset.rumboMaintenance='history';
     document.getElementById('historic-files')?.focus({preventScroll:true});
     return;
   }
   const fileButton=event.target.closest('[data-settings-file]');
   if(fileButton&&dialog.contains(fileButton)){
     const id=fileButton.dataset.settingsFile;
     const input=Object.prototype.hasOwnProperty.call(files,id)?document.getElementById(id):null;
     if(!input||input.type!=='file'){
       say('No está disponible el importador de esta sección. Los archivos existentes no se han modificado.');
       return;
     }
     const oneTime=()=>{
       // Captura antes de que el importador original borre input.value.
       if(!input.files?.length)return;
       dialog.close();
       if(id!=='history-home-file'&&!window.RumboNavigation?.go(files[id]))location.hash=files[id];
     };
     input.addEventListener('change',oneTime,{once:true,capture:true});
     input.click(); // Gesto directo: navegador abre selector de archivo original.
     return;
   }
   const actionButton=event.target.closest('[data-settings-click]');
   if(actionButton&&dialog.contains(actionButton)){
     const id=actionButton.dataset.settingsClick;
     const original=actions.has(id)?document.getElementById(id):null;
     if(!original||original.disabled){
       say('Esta exportación no está disponible en el estado actual. Conserva tus datos.');
       return;
     }
     original.click(); // Conserva todos los controladores y validaciones existentes.
     say('Operación solicitada. Comprueba la descarga o el aviso de la sección correspondiente.');
   }
 });
 window.addEventListener('rumbo:route-changed',event=>{
   if(event.detail?.route!=='historial-rumbo')delete document.body.dataset.rumboMaintenance;
 });
 // Enlaces antiguos de ChatGPT siguen funcionando, pero abren Ajustes.
 const oldChatLink=()=>{if(location.hash==='#rumbo-chatgpt-sync')openChat();};
 window.addEventListener('hashchange',oldChatLink);
 oldChatLink();
 window.RumboSettings=Object.freeze({open:()=>open.click(),openChat});
})();
