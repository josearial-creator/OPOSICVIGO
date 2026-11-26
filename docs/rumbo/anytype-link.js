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
      a.href='#productividad';a.removeAttribute('target');a.removeAttribute('rel');
      a.title='Consultar tareas sincronizadas';a.setAttribute('aria-label','Consultar tareas de Anytype en Rumbo');
      if(!a.querySelector('svg'))a.textContent='Anytype';
    });
    document.querySelectorAll('.rumbo-anytype-external').forEach(a=>{
      a.href=url;
      a.target='_blank';
      a.rel='noopener noreferrer';
      a.title=saved()?'Abrir mi página de Anytype':'Configurar enlace personal de Anytype';
      a.textContent=saved()?'Abrir en Anytype ↗':'Configurar enlace externo a Anytype (opcional)';
    });
  }
  window.RumboAnytypeRefresh=refresh;
  document.addEventListener('click',event=>{
    const menu=event.target.closest?.('.rumbo-anytype-link');
    if(menu){
      event.preventDefault();
      const scroll=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>document.getElementById('rumbo-anytype-tasks')?.scrollIntoView({block:'start'})));
      if(location.hash==='#productividad'){scroll();}
      else {window.addEventListener('rumbo:route-changed',scroll,{once:true});location.hash='productividad';}
      return;
    }
    const link=event.target.closest?.('.rumbo-anytype-external');
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
  const card=document.getElementById('rumbo-anytype-tasks');
  if(card){const external=document.createElement('a');external.className='rumbo-anytype-external';card.append(external);}
  refresh();
})();