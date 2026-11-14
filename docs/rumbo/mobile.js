(() => {
  'use strict';
  const mobile = window.matchMedia('(max-width: 560px)');
  const tabs = [...document.querySelectorAll('[data-mobile-tab]')];
  const page = document.querySelector('.page');
  if (!page) return;

  // La navegación es solo visual: no cambia almacenes ni datos personales.
  const sections = [...page.querySelectorAll(':scope > [data-mobile-screen]')];
  const groups = {
    hoy: [['inicio','Portada'],['mi-dia','Mi día'],['panel-hoy','Mi radar']],
    oposiciones: [['convocatorias','Convocatorias'],['favoritos','Favoritas'],['apuntes-estudio','Apuntes']],
    diario: [['mi-espacio','Mi espacio'],['ev-diary','Diario'],['historial-rumbo','Historial'],
      ['mi-evolucion','Mi evolución'],['ev-training','Entrenar'],['rumbo-chatgpt-sync','ChatGPT']],
    mas: [['productividad','Productividad'],['proyectos','Proyectos'],
      ['metricas-personales','Métricas'],['copias-rumbo','Copias']]
  };
  const groupTitles = {hoy:'Hoy',oposiciones:'Oposiciones',diario:'Diario',mas:'Más'};
  const routeGroups = new Map(Object.entries(groups).flatMap(([group,items])=>items.map(([id])=>[id,group])));
  const aliases = {'diario-menu':'mi-espacio'};
  const nav = document.createElement('nav');
  nav.className = 'rumbo-section-nav';
  nav.setAttribute('aria-label','Apartados de Rumbo');
  page.insertBefore(nav,page.firstElementChild);
  let active='inicio';

  function visible(el,route){
    if(el.classList.contains('ev-mobile-tree'))return false;
    const id=el.id;
    if(route==='inicio')return id==='mi-dia'||id==='history-recovery-home'||
      el.classList.contains('hero-line')||el.classList.contains('quick-actions');
    if(route==='convocatorias'||route==='favoritos')return id==='convocatorias'||id==='status'||
      el.classList.contains('stats')||el.classList.contains('note');
    return id===((route==='ev-diary'||route==='ev-training')?'mi-evolucion':route);
  }
  function renderNav(group,route){
    const h=document.createElement('h2');
    h.className='rumbo-section-title';
    h.textContent=groupTitles[group];
    const links=document.createElement('div');
    links.className='rumbo-section-links';
    for(const [id,label] of groups[group]){
      const a=document.createElement('a');
      a.href='#'+id;a.textContent=label;
      if(id===route)a.setAttribute('aria-current','page');
      links.append(a);
    }
    nav.replaceChildren(h,links);
  }
  function show(route,scroll){
    active=route;
    const group=routeGroups.get(route)||'hoy';
    document.body.dataset.mobileView=group;
    document.body.dataset.mobileReady=mobile.matches?'true':'false';
    document.body.dataset.rumboRoute=route;
    for(const el of sections)el.classList.toggle('rumbo-section-hidden',!visible(el,route));
    for(const tab of tabs){
      if(tab.dataset.mobileTab===group)tab.setAttribute('aria-current','page');
      else tab.removeAttribute('aria-current');
    }
    renderNav(group,route);
    document.body.classList.add('rumbo-separated');
    if(scroll)requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'instant'}));
  }
  function fromHash(){
    let hash='';
    try{hash=decodeURIComponent(location.hash.slice(1));}catch{hash=location.hash.slice(1);}
    const id=aliases[hash]||hash;
    return routeGroups.has(id)?id:(hash?active:'inicio');
  }
  function update(){show(fromHash(),true);}
  for(const tab of tabs){
    tab.addEventListener('click',()=>{
      if(tab.getAttribute('href')===location.hash)show(fromHash(),true);
    });
  }
  nav.addEventListener('click',e=>{
    const link=e.target.closest('a[href^="#"]');
    if(link&&link.getAttribute('href')===location.hash)show(fromHash(),true);
  });
  window.addEventListener('hashchange',update);
  mobile.addEventListener('change',()=>show(active,false));
  show(fromHash(),Boolean(location.hash));
  const offline = document.getElementById('rumbo-offline');
  function showConnection(){offline.hidden=navigator.onLine;}
  window.addEventListener('online',showConnection);
  window.addEventListener('offline',showConnection);
  showConnection();
  if('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}));
  }
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();installPrompt=event;
    const status=document.getElementById('install-status');
    if(status)status.textContent='Rumbo está preparado para instalarse en este dispositivo.';
  });
  window.RumboInstall = async function(){
    const status=document.getElementById('install-status');
    if(installPrompt){
      const event=installPrompt;installPrompt=null;
      try{await event.prompt();const answer=await event.userChoice;status.textContent=answer.outcome==='accepted'?'Instalación aceptada.':'Puedes instalar Rumbo más adelante.';}
      catch{status.textContent='No se pudo abrir la instalación. Utiliza el menú del navegador.';}
    }else status.textContent='Para instalar: abre el menú del navegador y elige «Instalar aplicación» o «Añadir a pantalla de inicio», si está disponible.';
  };
})();