(() => {
 'use strict';
 // La actualización solo recarga el código público: no se borran datos,
 // cookies, IndexedDB ni Cache Storage desde este módulo.
 const sw='serviceWorker' in navigator?navigator.serviceWorker:null;
 const banner=document.getElementById('rumbo-update-banner');
 const status=document.getElementById('rumbo-update-status');
 const checkButton=document.getElementById('rumbo-update-check');
 const applyButton=document.getElementById('rumbo-update-apply');
 const settingsApply=document.getElementById('rumbo-update-apply-settings');
 const later=document.getElementById('rumbo-update-later');
 if(!banner||!status||!checkButton||!applyButton||!settingsApply||!later)return;
 let registration=null,available=false,dismissed=false,checking=false,lastCheck=0;
 // No anunciar como actualización la primera instalación del service worker.
 let originallyControlled=Boolean(sw?.controller);
 const say=text=>{status.textContent=text;};
 const showReady=()=>{
   if(!originallyControlled)return;
   available=true;
   say('Hay una versión nueva de Rumbo preparada. Puedes actualizar cuando hayas guardado lo que estés escribiendo.');
   settingsApply.hidden=false;
   if(!dismissed)banner.hidden=false;
 };
 const apply=()=>{
   if(!available)return;
   // Recargar nunca borra registros, pero un formulario no enviado podría perder texto.
   if(!confirm('¿Actualizar Rumbo ahora? Guarda primero cualquier texto o formulario que estés editando. Los registros ya guardados se conservarán.'))return;
   location.reload();
 };
 applyButton.addEventListener('click',apply);
 settingsApply.addEventListener('click',apply);
 later.addEventListener('click',()=>{dismissed=true;banner.hidden=true;say('Actualización pendiente. Puedes aplicarla más tarde desde Ajustes.');});
 async function check(silent=false){
   if(checking)return;
   if(!sw||!window.isSecureContext){
     if(!silent)say('No se puede comprobar automáticamente en este navegador. Abre Rumbo desde HTTPS.');
     return;
   }
   if(!navigator.onLine){
     if(!silent)say('Sin conexión. La versión actual sigue disponible; vuelve a intentarlo cuando tengas internet.');
     return;
   }
   checking=true;checkButton.disabled=true;
   if(!silent)say('Buscando una versión nueva de Rumbo…');
   try{
     const reg=registration||await sw.getRegistration('./');
     if(!reg)throw Error('La aplicación todavía no se ha instalado como sitio disponible sin conexión.');
     registration=reg;
     await reg.update();
     lastCheck=Date.now();
     if(!available&&!silent)say('Comprobación realizada. Si hay una versión nueva, aparecerá el aviso cuando esté preparada.');
   }catch{
     if(!silent)say('No se pudo comprobar ahora. Tus datos siguen guardados y puedes seguir usando Rumbo.');
   }finally{
     checking=false;checkButton.disabled=false;
   }
 }
 checkButton.addEventListener('click',()=>{void check();});
 if(sw){
   sw.addEventListener('controllerchange',()=>{
     if(originallyControlled)showReady();
     else originallyControlled=true;
   });
 }
 window.RumboUpdates=Object.freeze({
   attach(reg){
     registration=reg;
     if(sw?.controller&&originallyControlled&&reg.waiting)showReady();
     if(!lastCheck)lastCheck=Date.now();
   },
   unavailable(){say('No está disponible la comprobación automática. Puedes seguir usando Rumbo sin perder tus datos.');},
   check:()=>check(),
   available:()=>available
 });
 document.addEventListener('visibilitychange',()=>{
   // Una comprobación como máximo cada seis horas al volver a abrir la PWA.
   if(!document.hidden&&Date.now()-lastCheck>=21600000)void check(true);
 });
 if(!sw)window.RumboUpdates.unavailable();
})();
