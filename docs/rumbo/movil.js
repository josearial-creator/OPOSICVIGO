/* Navegación progresiva: no lee ni modifica los almacenes de Rumbo. */
(() => {
  'use strict';
  const sidebar = document.querySelector('.sidebar nav');
  if (!sidebar || !window.HTMLDialogElement) return;
  const menu = document.createElement('dialog');
  menu.id = 'mobile-menu';
  menu.className = 'mobile-menu';
  menu.setAttribute('aria-labelledby', 'mobile-menu-title');
  menu.innerHTML = '<div class="mobile-menu-head"><h2 id="mobile-menu-title">Tu espacio</h2><button type="button" class="button secondary" aria-label="Cerrar menú">Cerrar</button></div><p>Elige dónde quieres continuar.</p><nav aria-label="Todas las secciones"></nav>';
  const destinations = new Set();
  sidebar.querySelectorAll('a[href^="#"]').forEach(source => {
    if (destinations.has(source.hash)) return;
    destinations.add(source.hash);
    const link = source.cloneNode(true);
    link.removeAttribute('data-nav');
    link.className = 'mobile-menu-link';
    if (source.hash === '#inicio') link.textContent = 'Inicio';
    menu.querySelector('nav').append(link);
  });
  const nav = document.createElement('nav');
  nav.className = 'mobile-dock';
  nav.setAttribute('aria-label', 'Navegación principal móvil');
  nav.innerHTML = '<a href="#mi-dia"><span aria-hidden="true">☼</span>Hoy</a><a href="#ev-diary"><span aria-hidden="true">▤</span>Diario</a><a href="#apuntes-estudio"><span aria-hidden="true">✎</span>Estudio</a><button type="button" aria-haspopup="dialog" aria-controls="mobile-menu" aria-expanded="false"><span aria-hidden="true">☰</span>Más</button>';
  document.body.append(menu, nav);
  const toggle = nav.querySelector('button');
  toggle.addEventListener('click', () => { menu.showModal(); toggle.setAttribute('aria-expanded', 'true'); });
  menu.querySelector('button').addEventListener('click', () => menu.close());
  menu.addEventListener('close', () => toggle.setAttribute('aria-expanded', 'false'));
  menu.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (!link) return;
    menu.close();
    // Mantiene los enlaces directos y permite repetir el destino actual.
    requestAnimationFrame(() => {
      const target = document.getElementById(link.hash.slice(1) === 'favoritos' ? 'convocatorias' : link.hash.slice(1));
      if (target) { target.setAttribute('tabindex', '-1'); target.focus({preventScroll:true}); target.scrollIntoView(); }
    });
  });
  function active() {
    const hash = location.hash || '#mi-dia';
    nav.querySelectorAll('a').forEach(link => {
      const selected = link.hash === hash || (link.hash === '#mi-dia' && hash === '#inicio');
      if (selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange', active);
  const small = matchMedia('(max-width: 760px)');
  small.addEventListener('change', () => { if (!small.matches && menu.open) menu.close(); });
  active();
  document.documentElement.classList.add('mobile-ready');
})();
