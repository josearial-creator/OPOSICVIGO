(() => {
  'use strict';
  const body = document.querySelector('#mi-dia .assistant-body');
  if (!body) return;
  const card = document.createElement('section');
  card.className = 'assistant-card weekly-agenda';
  card.setAttribute('aria-labelledby', 'weekly-agenda-heading');
  card.innerHTML = '<h3 id="weekly-agenda-heading">Agenda · próximos 7 días</h3><p role="status" aria-live="polite"></p><div data-agenda-list></div><button type="button" class="button secondary" data-refresh>Comprobar conexión</button>';
  body.prepend(card);
  const key = 'rumbo-agenda-google-ical-v1';
  const list = card.querySelector('[data-agenda-list]');
  const status = card.querySelector('[role=status]'), refresh = card.querySelector('[data-refresh]');
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
  let url = '', generation = 0, lastRead = 0, requestedDay = '', lastSuccess = 0, pending = false, hadError = false, configured = false;
  try { url = localStorage.getItem(key) || ''; } catch {}
  function controls() {
    refresh.disabled = !window.RumboSession?.available();
    if (refresh.disabled) status.textContent = 'Abre el acceso privado de Rumbo para consultar tu agenda.';
  }
  async function read() {
    const pass = window.RumboSession?.use();
    if (!pass || pending) return;
    const auth = 'Rumbo ' + btoa(String.fromCharCode(...new TextEncoder().encode(pass)));
    const id = ++generation;
    lastRead = Date.now(); pending=true;
    requestedDay = windowStart();
    status.textContent = 'Consultando citas…';
    if(!lastSuccess||card.dataset.agendaDay!==requestedDay)list.replaceChildren();
    try {
      const response = await fetch('/agenda-semanal', {method:'POST', cache:'no-store', headers:{'Content-Type':'application/json',Authorization:auth}, body:JSON.stringify(url?{url}:{})});
      if (id !== generation || window.RumboSession?.use() !== pass) return;
      const data = await response.json();
      if (id !== generation) return;
      if (!response.ok || !Array.isArray(data.events)) throw Error(data.error || 'No se pudo cargar la agenda.');
      if (windowStart() !== requestedDay) {
        pending=false;void read();
        return;
      }
      if (data.start !== requestedDay || data.last !== dayPlus(requestedDay,6)) {
        throw Error('La agenda no ha devuelto el intervalo actualizado. Vuelve a intentarlo.');
      }
      configured=true;
      // El servidor ha confirmado la configuración y la consulta. No volver a enviar el enlace antiguo.
      if(url){try{localStorage.removeItem(key);}catch{}url='';}
      list.replaceChildren();lastSuccess=Date.now();hadError=false;card.dataset.agendaDay=data.start;
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
      if (id === generation) {hadError=true;configured=false;status.textContent = error instanceof SyntaxError ? 'El servicio de agenda no está disponible en esta versión.' : (error.message || 'No se pudo cargar la agenda.');}
    }finally{if(id===generation)pending=false;}
  }
  refresh.addEventListener('click', () => void read());
  window.RumboAgenda=Object.freeze({refreshControl:()=>refresh,connected:()=>configured,status:()=>({connected:configured,pending,lastSuccess,error:hadError}),sync:()=>read()});
  function updateIfDue() {
    if(pending||!window.RumboSession?.available())return;
    if (requestedDay !== windowStart() || (!document.hidden && Date.now()-lastRead>=300000)) void read();
  }
  window.RumboSession?.subscribe(available=>{
    ++generation;pending=false;configured=false;lastSuccess=0;lastRead=0;requestedDay='';hadError=false;
    list.replaceChildren();controls();
    if(available)void read();
  });
  controls();
  void read();
  document.addEventListener('visibilitychange', updateIfDue);
  window.addEventListener('focus', updateIfDue);
  window.addEventListener('pageshow', updateIfDue);
  window.addEventListener('online', updateIfDue);
  // Check at each clock minute, including 23:59; resume checks cover suspended apps.
  function nextMinute() {
    window.setTimeout(() => {
      updateIfDue();
      nextMinute();
    }, 60000 - Date.now() % 60000);
  }
  nextMinute();
})();