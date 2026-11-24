(() => {
  'use strict';
  const body = document.querySelector('#mi-dia .assistant-body');
  if (!body) return;
  const card = document.createElement('section');
  card.className = 'assistant-card';
  card.innerHTML = '<h3>Mis citas de la semana</h3><p role="status" aria-live="polite"></p><div data-agenda-list></div><details><summary>Conectar Google Calendar</summary><form><label>Dirección secreta en formato iCal<input type="password" required autocomplete="off" spellcheck="false"></label><p>En Google Calendar desde un ordenador, abre Configuración, elige tu calendario y entra en Integrar el calendario. Pega aquí su dirección secreta. Rumbo la guarda en este navegador y la usa para consultar las citas.</p><button class="button primary">Conectar</button> <button class="button secondary" type="button" data-disconnect>Desconectar</button></form></details><button type="button" class="button secondary" data-refresh>Actualizar citas</button>';
  body.prepend(card);
  const key = 'rumbo-agenda-google-ical-v1';
  const form = card.querySelector('form'), input = form.querySelector('input');
  const details = card.querySelector('details'), list = card.querySelector('[data-agenda-list]');
  const status = card.querySelector('[role=status]'), refresh = card.querySelector('[data-refresh]');
  const disconnect = card.querySelector('[data-disconnect]');
  const dateLabel = new Intl.DateTimeFormat('es-ES', {weekday:'long', day:'numeric', month:'long',timeZone:'UTC'});
  let url = '', generation = 0, lastRead = 0;
  try { url = localStorage.getItem(key) || ''; } catch {}
  function controls() {
    details.open = !url;
    refresh.hidden = disconnect.hidden = !url;
    card.querySelector('summary').textContent = url ? 'Configurar calendario' : 'Conectar Google Calendar';
    if (!url) status.textContent = 'Conecta tu calendario para ver aquí tus citas de lunes a domingo.';
  }
  async function read(candidate = url, connect = false) {
    if (!candidate) return;
    const id = ++generation;
    lastRead = Date.now();
    status.textContent = 'Consultando citas…';
    list.replaceChildren();
    try {
      const response = await fetch('/agenda-semanal', {method:'POST', cache:'no-store', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url:candidate})});
      if (id !== generation) return;
      const data = await response.json();
      if (id !== generation) return;
      if (!response.ok || !Array.isArray(data.events)) throw Error(data.error || 'No se pudo cargar la agenda.');
      if (connect) {
        localStorage.setItem(key, candidate);
        url = candidate;
        form.reset();
        controls();
      }
      status.textContent = data.events.length ? 'Semana del ' + dateLabel.format(new Date(data.start + 'T12:00:00Z')) : 'Esta semana no tienes citas en este calendario.';
      let previousDay = '', items;
      for (const event of data.events) {
        if (event.day !== previousDay) {
          const heading = document.createElement('h4');
          heading.textContent = dateLabel.format(new Date(event.day + 'T12:00:00Z'));
          items = document.createElement('ul');
          list.append(heading, items);
          previousDay = event.day;
        }
        const item = document.createElement('li');
        item.textContent = (event.hour || 'Todo el día') + ' · ' + event.title;
        items.append(item);
      }
    } catch (error) {
      if (id === generation) status.textContent = error instanceof SyntaxError ? 'El servicio de agenda no está disponible en esta versión.' : (error.message || 'No se pudo cargar la agenda.');
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); void read(input.value.trim(), true); });
  disconnect.addEventListener('click', () => {
    ++generation;
    localStorage.removeItem(key);
    url = '';
    list.replaceChildren();
    form.reset();
    controls();
  });
  refresh.addEventListener('click', () => void read());
  function updateIfDue() {
    if (!document.hidden && url && Date.now() - lastRead >= 300000) void read();
  }
  controls();
  void read();
  document.addEventListener('visibilitychange', updateIfDue);
  window.setInterval(updateIfDue, 300000);
})();