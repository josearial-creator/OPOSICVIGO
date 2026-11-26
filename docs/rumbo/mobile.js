(() => {
  'use strict';
  const mobile = window.matchMedia('(max-width: 560px)');
  const tabs = [...document.querySelectorAll('[data-mobile-tab]')];
  const page = document.querySelector('.page');
  if (!page) return;
  // Saltar los menús no cambia la ruta ni escribe en el almacenamiento.
  const skipLink = document.querySelector('.rumbo-skip-link');
  skipLink?.addEventListener('click', event => {
    event.preventDefault();
    page.focus({preventScroll:true});
    page.scrollIntoView({block:'start',behavior:'auto'});
  });

  // La navegación es solo visual: no cambia almacenes ni datos personales.
  const sections = [...page.querySelectorAll(':scope > [data-mobile-screen]')];
  const groups = {
    hoy: [['inicio','Portada'],['mi-dia','Mi día'],['panel-hoy','Mi radar']],
    oposiciones: [['convocatorias','Convocatorias'],['favoritos','Favoritas'],['apuntes-estudio','Apuntes']],
    diario: [['mi-espacio','Mi espacio'],['ev-diary','Diario'],['historial-rumbo','Historial'],
      ['mi-evolucion','Mis prácticas'],['observatorio-personal','Observatorio emocional'],['ev-training','Entrenamiento']],
    mas: [['productividad','Productividad'],['proyectos','Proyectos'],
      ['metricas-personales','Métricas'],['copias-rumbo','Copias']]
  };
  const groupTitles = {hoy:'Hoy',oposiciones:'Oposiciones',diario:'Diario',mas:'Foco y herramientas'};
  const routeGroups = new Map(Object.entries(groups).flatMap(([group,items])=>items.map(([id])=>[id,group])));
  const aliases = {'diario-menu':'mi-espacio',hoy:'mi-dia',estudio:'productividad',diario:'mi-espacio',planificacion:'proyectos','rumbo-chatgpt-sync':'inicio'};
  const labels=new Map(Object.values(groups).flat().map(([id,label])=>[id,label]));
  const nav = document.createElement('nav');
  nav.className = 'rumbo-section-nav';
  nav.setAttribute('aria-label','Apartados de Rumbo');
  page.insertBefore(nav,page.firstElementChild);
  // Acciones cotidianas: reutilizar los controles existentes, sin duplicar datos.
  const daily = document.createElement('nav');
  daily.className = 'rumbo-daily-actions';
  daily.setAttribute('aria-label','Acciones de hoy');
  daily.hidden = true;
  const dailyActions = [
    ['Nueva tarea','task','M12 5v14M5 12h14'],
    ['Agenda','agenda','M5 7h14v13H5zM5 11h14M8 4v5M16 4v5'],
    ['Escribir','mi-espacio','M4 20l4-1 12-12-3-3L5 16zM14 7l3 3'],
    ['Estudiar / foco','productividad','M12 8v5l3 2M9 2h6M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16']
  ];
  for(const [label,id,path] of dailyActions){
    const local=id==='task'||id==='agenda';
    const control=document.createElement(local?'button':'a');
    if(local)control.type='button';else control.href='#'+id;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
    const line=document.createElementNS('http://www.w3.org/2000/svg','path');line.setAttribute('d',path);svg.append(line);
    const name=document.createElement('span');name.textContent=label;control.append(svg,name);
    if(local)control.addEventListener('click',()=>{
      const target=document.querySelector(id==='task'?'#assistant-capture input[name="text"]':'#weekly-agenda-heading');
      if(!target)return;
      if(id==='agenda')target.tabIndex=-1;
      target.focus({preventScroll:true});target.scrollIntoView({block:'center',behavior:'instant'});
    });
    daily.append(control);
  }
  nav.insertAdjacentElement('afterend',daily);
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
      // Las herramientas técnicas solo se muestran al abrir Ajustes.
      if(id==='rumbo-chatgpt-sync'||id==='copias-rumbo')continue;
      const a=document.createElement('a');
      a.href='#'+id;a.textContent=label;
      if(id===route)a.setAttribute('aria-current','page');
      links.append(a);
    }
    if(group==='mas'){
      const external=document.createElement('a');
      external.className='rumbo-anytype-link';
      external.href='https://object.any.coop/';
      external.target='_blank';
      external.rel='noopener noreferrer';
      external.textContent='Anytype ↗';
      external.setAttribute('aria-label','Abrir Anytype en una pestaña nueva');
      links.append(external);
    }
    nav.replaceChildren(h,links);
    window.RumboAnytypeRefresh?.();
  }
  function show(route,scroll){
    const focusAtTransition=document.activeElement;
    active=route;
    const group=routeGroups.get(route)||'hoy';
    document.body.dataset.mobileView=group;
    document.body.dataset.mobileReady=mobile.matches?'true':'false';
    document.body.dataset.rumboRoute=route;
    for(const el of sections){
      // El formulario de ChatGPT ha sido trasladado a Ajustes y no es una pantalla.
      if(el.id==='rumbo-chatgpt-sync')continue;
      el.classList.toggle('rumbo-section-hidden',!visible(el,route));
    }
    for(const tab of tabs){
      if(tab.dataset.mobileTab===group)tab.setAttribute('aria-current','page');
      else tab.removeAttribute('aria-current');
    }
    renderNav(group,route);
    daily.hidden=route!=='inicio'&&route!=='mi-dia';

    // Una sola pantalla también al entrar sin fragmento desde un ordenador.
    document.body.classList.add('rumbo-separated');
    const label=labels.get(route)||'Portada';
    document.title=label+' · Rumbo';
    const breadcrumb=document.querySelector('.breadcrumb strong');
    if(breadcrumb)breadcrumb.textContent=label;
    for(const a of document.querySelectorAll('[data-nav]')){
      a.classList.toggle('active',a.dataset.nav===route);
      if(a.dataset.nav===route)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
    }
    window.dispatchEvent(new CustomEvent('rumbo:route-changed',{detail:{route,group}}));
    if(scroll)requestAnimationFrame(()=>{
      // El usuario puede haber enfocado ya un control mientras se cambiaba de
      // pantalla: no robarle ese foco con un callback de navegación retrasado.
      const focusedNow=document.activeElement;
      if(focusedNow!==focusAtTransition &&
         focusedNow!==document.body &&
         focusedNow!==document.documentElement)return;
      if(document.querySelector('dialog[open]'))return;
      window.scrollTo({top:0,behavior:'instant'});
      const target=route==='inicio'?document.querySelector('.hero-line'):document.getElementById(route==='favoritos'?'convocatorias':route);
      const heading=target?.querySelector('h1,h2')||target?.querySelector('h3');
      if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
    });
  }
  function fromHash(){
    let hash='';
    try{hash=decodeURIComponent(location.hash.slice(1));}catch{hash=location.hash.slice(1);}
    const id=aliases[hash]||hash;
    return routeGroups.has(id)?id:'inicio';
  }
  function update(){show(fromHash(),true);}
  window.RumboNavigation={current:()=>active,resolve:id=>aliases[id]||id,go:route=>{const id=aliases[route]||route;if(!routeGroups.has(id))return false;if(location.hash==='#'+id)show(id,true);else location.hash=id;return true;}};
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
  if(navigator.serviceWorker?.register && window.isSecureContext) {
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'})
      .then(reg=>window.RumboUpdates?.attach(reg))
      .catch(()=>window.RumboUpdates?.unavailable()));
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
      try{await event.prompt();const answer=await event.userChoice;if(status)status.textContent=answer.outcome==='accepted'?'Instalación aceptada.':'Puedes instalar Rumbo más adelante.';}
      catch{if(status)status.textContent='No se pudo abrir la instalación. Utiliza el menú del navegador.';}
    }else if(status)status.textContent='Para instalar: abre el menú del navegador y elige «Instalar aplicación» o «Añadir a pantalla de inicio», si está disponible.';
  };
})();