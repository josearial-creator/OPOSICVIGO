(() => {
  'use strict';
  // La dirección personal no se incluye en el repositorio público.
  const key='rumbo-anytype-link-v1';
  const fallback='https://object.any.coop/';
  const viewerKey='rumbo-anytype-private-viewer-v1';
  function validViewer(value){
    try{const url=new URL(value);if(url.protocol!=='https:'||!url.hostname.endsWith('.ts.net')||url.username||url.password||url.search||url.hash||url.pathname!=='/')return null;return url.href;}catch{return null;}
  }
  function savedViewer(){try{return validViewer(localStorage.getItem(viewerKey)||'');}catch{return null;}}
  function installViewer(card){
    const panel=document.createElement('section');panel.id='rumbo-anytype-space';panel.className='assistant-card';
    panel.innerHTML='<h3>Mi espacio Anytype</h3><p>Consulta el espacio completo desde tu servidor privado, en modo de solo lectura. Requiere Tailscale.</p><p><a class="button primary" data-anytype-viewer target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" hidden>Abrir mi espacio</a> <a href="#productividad" data-anytype-task-jump>Ver mis tareas sincronizadas</a></p><details data-anytype-viewer-settings><summary>Configurar acceso al visor privado</summary><form><label>Dirección HTTPS de tu visor Tailscale<input type="url" required placeholder="https://servidor.red.ts.net:8443/" autocomplete="off"></label><button class="button secondary" type="submit">Guardar dirección</button> <button class="button secondary" type="button" data-forget>Quitar dirección</button><p role="status" aria-live="polite"></p></form></details><p><a class="rumbo-anytype-external"></a></p>';
    card.before(panel);
    const open=panel.querySelector('[data-anytype-viewer]'),settings=panel.querySelector('details'),form=panel.querySelector('form'),input=form.querySelector('input'),status=form.querySelector('[role=status]');
    function update(){const url=savedViewer();open.hidden=!url;if(url)open.href=url;else open.removeAttribute('href');input.value=url||'';settings.open=!url;}
    form.addEventListener('submit',event=>{event.preventDefault();const url=validViewer(input.value.trim());if(!url){status.textContent='Introduce una dirección HTTPS de tu red Tailscale, sin credenciales ni parámetros.';return;}try{localStorage.setItem(viewerKey,url);update();status.textContent='Dirección guardada en este navegador.';}catch{status.textContent='No se pudo guardar la dirección.';}});
    form.querySelector('[data-forget]').addEventListener('click',()=>{try{localStorage.removeItem(viewerKey);update();status.textContent='Dirección eliminada.';}catch{status.textContent='No se pudo eliminar la dirección.';}});
    panel.querySelector('[data-anytype-task-jump]').addEventListener('click',event=>{event.preventDefault();card.scrollIntoView({block:'start'});});
    update();
  }
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
      a.title='Mi espacio Anytype y tareas sincronizadas';a.setAttribute('aria-label','Abrir mi espacio Anytype en Rumbo');
      if(!a.querySelector('svg'))a.textContent='Anytype';
    });
    document.querySelectorAll('.rumbo-anytype-external').forEach(a=>{
      a.href=url;
      a.target='_blank';
      a.rel='noopener noreferrer';
      a.title=saved()?'Abrir mi página de Anytype':'Configurar enlace personal de Anytype';
      a.textContent=saved()?'Abrir en la aplicación Anytype ↗':'Configurar enlace a la aplicación Anytype (opcional)';
    });
  }
  window.RumboAnytypeRefresh=refresh;
  document.addEventListener('click',event=>{
    const menu=event.target.closest?.('.rumbo-anytype-link');
    if(menu){
      event.preventDefault();
      const scroll=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>document.getElementById('rumbo-anytype-space')?.scrollIntoView({block:'start'})));
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
  if(card)installViewer(card);
  refresh();
})();