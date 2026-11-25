(() => {
  'use strict';
  const body = document.querySelector('#mi-dia .assistant-body');
  if (!body) return;
  const card = document.createElement('section');
  card.className = 'assistant-card weekly-agenda';
  card.setAttribute('aria-labelledby', 'weekly-agenda-heading');
  card.innerHTML = '<h3 id="weekly-agenda-heading">Agenda · próximos 7 días</h3><p role="status" aria-live="polite"></p><div data-agenda-list></div><details><summary>Conectar Google Calendar</summary><form><label>Dirección secreta en formato iCal<input type="password" required autocomplete="off" spellcheck="false"></label><p>En Google Calendar desde un ordenador, abre Configuración, elige tu calendario y entra en Integrar el calendario. Pega aquí su dirección secreta. Rumbo la guarda en este navegador y la usa para consultar las citas.</p><button class="button primary">Conectar</button> <button class="button secondary" type="button" data-disconnect>Desconectar</button></form></details><button type="button" class="button secondary" data-refresh>Actualizar citas</button>';
  body.prepend(card);
  const key = 'rumbo-agenda-google-ical-v1';
  const form = card.querySelector('form'), input = form.querySelector('input');
  const details = card.querySelector('details'), list = card.querySelector('[data-agenda-list]');
  const status = card.querySelector('[role=status]'), refresh = card.querySelector('[data-refresh]');
  const disconnect = card.querySelector('[data-disconnect]');
  const dateLabel = new Intl.DateTimeFormat('es-ES', {weekday:'long', day:'numeric', month:'long',timeZone:'UTC'});
  const madridClock = new Intl.DateTimeFormat('en-GB', {
    timeZone:'Europe/Madrid', year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hourCycle:'h23'
  });
  function dayPlus(day, count) {
    const date = new Date(day + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + count);
    return date.toISOString().slice(0,10);
  }
  function windowStart(now = new Date()) {
    const parts = Object.fromEntries(madridClock.formatToParts(now).map(p => [p.type,p.value]));
    const day = parts.year + '-' + parts.month + '-' + parts.day;
    return parts.hour === '23' && parts.minute === '59' ? dayPlus(day,1) : day;
  }
  let url = '', generation = 0, lastRead = 0, requestedDay = '';
  try { url = localStorage.getItem(key) || ''; } catch {}
  function controls() {
    details.open = !url;
    refresh.hidden = disconnect.hidden = !url;
    card.querySelector('summary').textContent = url ? 'Configurar calendario' : 'Conectar Google Calendar';
    if (!url) status.textContent = 'Conecta tu calendario para ver aquí tus citas de los próximos siete días.';
  }
  async function read(candidate = url, connect = false) {
    if (!candidate) return;
    const id = ++generation;
    lastRead = Date.now();
    requestedDay = windowStart();
    status.textContent = 'Consultando citas…';
    list.replaceChildren();
    try {
      const response = await fetch('/agenda-semanal', {method:'POST', cache:'no-store', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url:candidate})});
      if (id !== generation) return;
      const data = await response.json();
      if (id !== generation) return;
      if (!response.ok || !Array.isArray(data.events)) throw Error(data.error || 'No se pudo cargar la agenda.');
      if (windowStart() !== requestedDay) {
        void read(candidate, connect);
        return;
      }
      if (data.start !== requestedDay || data.last !== dayPlus(requestedDay,6)) {
        throw Error('La agenda no ha devuelto el intervalo actualizado. Vuelve a intentarlo.');
      }
      if (connect) {
        localStorage.setItem(key, candidate);
        url = candidate;
        form.reset();
        controls();
      }
      const formatDay = day => dateLabel.format(new Date(day + 'T12:00:00Z'));
      status.textContent = 'Del ' + formatDay(data.start) + ' al ' + formatDay(data.last) +
        (data.events.length ? '' : ' · Sin citas.');
      if (data.events.length) {
        const items = document.createElement('ul');
        for (const event of data.events) {
          if (event.day < data.start || event.day > data.last) continue;
          const item = document.createElement('li');
          const day = document.createElement('time');
          day.dateTime = event.day;
          day.textContent = formatDay(event.day);
          const hour = document.createElement('strong');
          hour.textContent = event.hour || 'Todo el día';
          const subject = document.createElement('span');
          subject.textContent = event.title;
          item.append(day, ' ', hour, ' ', subject);
          items.append(item);
        }
        list.append(items);
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
    if (url && requestedDay !== windowStart()) {
      void read();
    } else if (!document.hidden && url && Date.now() - lastRead >= 300000) {
      void read();
    }
  }
  controls();
  void read();
  document.addEventListener('visibilitychange', updateIfDue);
  window.addEventListener('focus', updateIfDue);
  window.addEventListener('pageshow', updateIfDue);
  // Check at each clock minute, including 23:59; resume checks cover suspended apps.
  function nextMinute() {
    window.setTimeout(() => {
      updateIfDue();
      nextMinute();
    }, 60000 - Date.now() % 60000);
  }
  nextMinute();
})();