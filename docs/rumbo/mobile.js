(() => {
  'use strict';
  const mobile = window.matchMedia('(max-width: 560px)');
  const links = [...document.querySelectorAll('[data-mobile-tab]')];
  const paths = {
    oposiciones: new Set(['convocatorias','favoritos','apuntes-estudio']),
    diario: new Set(['ev-diary','ev-training','mi-evolucion','rumbo-chatgpt-sync','historial-rumbo','diario-menu']),
    mas: new Set(['productividad','proyectos','metricas-personales','copias-rumbo'])
  };
  function screenFor(hash) {
    for(const [screen,ids] of Object.entries(paths))if(ids.has(hash))return screen;
    return 'hoy';
  }
  function showScreen(screen) {
    document.body.dataset.mobileView = screen;
    document.body.dataset.mobileReady = mobile.matches ? 'true' : 'false';
    for(const link of links){
      if(link.dataset.mobileTab === screen)link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    }
  }
  function update() {
    const id = decodeURIComponent(location.hash.slice(1));
    showScreen(screenFor(id));
    // Los enlaces directos a una pantalla oculta deben desplazarse después de mostrarla.
    if(id==='historial-rumbo' && mobile.matches){
      requestAnimationFrame(()=>document.getElementById('historial-rumbo')?.scrollIntoView({block:'start'}));
    }
  }
  for(const link of links)link.addEventListener('click',()=>showScreen(link.dataset.mobileTab));
  window.addEventListener('hashchange',update);
  mobile.addEventListener('change',update);
  update();
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