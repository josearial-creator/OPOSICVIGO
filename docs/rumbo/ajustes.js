(() => {
 'use strict';
 const open=document.getElementById('rumbo-settings-open');
 const dialog=document.getElementById('rumbo-settings-dialog');
 if(!open||!dialog)return;
 const close=document.getElementById('rumbo-settings-close');
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
 close.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{
   if(event.target===dialog)dialog.close();
 });
 dialog.addEventListener('click',event=>{
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
 window.RumboSettings=Object.freeze({open:()=>open.click()});
})();
