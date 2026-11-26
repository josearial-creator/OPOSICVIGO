(() => {
  'use strict';
  // La dirección personal no se incluye en el repositorio público.
  const key='rumbo-anytype-link-v1';
  const fallback='https://object.any.coop/';
  function valid(value){
    try {
      const url=new URL(value);
      if(url.username||url.password||url.port)return null;
      if(url.protocol==='https:' && url.hostname==='object.any.coop')return url.href;
      if(url.protocol==='anytype:' && url.hostname==='object' && url.pathname.length>1)return url.href;
      return null;
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
    if(configured){link.href=configured;if(configured.startsWith('anytype:')){event.preventDefault();window.location.href=configured;}return;}
    event.preventDefault();
    const entered=window.prompt('Pega el enlace de tu objeto privado de Anytype (Copiar enlace o Copiar enlace directo). No tienes que publicarlo. Se guarda solo en este navegador:');
    if(entered===null)return;
    const url=valid(entered.trim());
    if(!url){
      window.alert('Copia un enlace de objeto de Anytype: https://object.any.coop/… o anytype://object/…');
      return;
    }
    try {localStorage.setItem(key,url);}
    catch {window.alert('No se pudo guardar el enlace en este navegador.');return;}
    refresh();
    if(url.startsWith('anytype:'))window.location.href=url;
    else window.open(url,'_blank','noopener,noreferrer');
  });
  refresh();
})();