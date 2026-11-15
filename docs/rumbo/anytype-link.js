(() => {
  'use strict';
  // La dirección personal no se incluye en el repositorio público.
  const key='rumbo-anytype-link-v1';
  const fallback='https://object.any.coop/';
  function valid(value){
    try {
      const url=new URL(value);
      return url.protocol==='https:' && url.hostname==='object.any.coop'
        && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function saved(){
    try { return valid(localStorage.getItem(key)||''); } catch { return null; }
  }
  function refresh(){
    const url=saved()||fallback;
    document.querySelectorAll('.rumbo-anytype-link').forEach(a=>{
      a.href=url;
      a.target='_blank';
      a.rel='noopener noreferrer';
      a.title=saved()?'Abrir mi página de Anytype':'Configurar enlace personal de Anytype';
    });
  }
  window.RumboAnytypeRefresh=refresh;
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('.rumbo-anytype-link');
    if(!link)return;
    const configured=saved();
    if(configured){link.href=configured;return;}
    event.preventDefault();
    const entered=window.prompt('Pega aquí el enlace de tu página publicada en Anytype. Solo se guardará en este navegador:');
    if(entered===null)return;
    const url=valid(entered.trim());
    if(!url){
      window.alert('El enlace debe ser HTTPS y pertenecer a object.any.coop.');
      return;
    }
    try {localStorage.setItem(key,url);}
    catch {window.alert('No se pudo guardar el enlace en este navegador.');return;}
    refresh();
    window.open(url,'_blank','noopener,noreferrer');
  });
  refresh();
})();