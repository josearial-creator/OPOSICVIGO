/* Registro local de transiciones para la comida. No modifica Diario ni Mi evolución. */
(() => {
  'use strict';
  const host = document.getElementById('mi-dia');
  if (!host) return;

  const KEY = 'rumbo-transiciones-v1';
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const CHOICES = ['', 'baja', 'media', 'alta'];
  const today = (date = new Date()) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
  const isISO = value => typeof value === 'string' &&
    Number.isFinite(new Date(value).getTime());
  const valid = value => value && value.version === 1 &&
    Array.isArray(value.records) && value.records.length <= 2000 &&
    value.records.every(r => r && DAY_RE.test(r.day) &&
      isISO(r.stopAt) && (r.mealAt === null || isISO(r.mealAt)) &&
      CHOICES.includes(r.difficulty)) &&
    new Set(value.records.map(r => r.day)).size === value.records.length;
  const clock = iso => new Date(iso).toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit'
  });
  const empty = () => ({version: 1, records: []});
  let data = empty(), locked = false;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (!valid(parsed)) throw Error('formato incompatible');
      data = parsed;
    }
  } catch (_) { locked = true; }

  const panel = document.createElement('section');
  panel.className = 'assistant-card transition-panel';
  panel.setAttribute('aria-label', 'Rutina de parada para comer');
  panel.innerHTML = [
    '<h3>Parar para comer</h3>',
    '<p class="assistant-muted">De lunes a viernes: alarma del móvil a las <strong>13:45</strong>; objetivo de empezar a comer a las <strong>14:00</strong>. Las alarmas se configuran en el teléfono; Rumbo solo registra cuando pulsas.</p>',
    '<div class="transition-actions">',
    '<button type="button" class="button primary" id="transition-stop">He parado</button>',
    '<button type="button" class="button secondary" id="transition-meal">He empezado a comer</button>',
    '</div>',
    '<label class="transition-difficulty">Dificultad para parar (opcional)',
    '<select id="transition-difficulty"><option value="">Sin indicar</option>',
    '<option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select></label>',
    '<p id="transition-status" class="transition-status" role="status" aria-live="polite"></p>',
    '<div id="transition-summary" class="transition-summary" aria-label="Resumen semanal"></div>',
    '<button type="button" class="button secondary" id="transition-export">Exportar mis registros</button>',
    '<p class="assistant-muted">Guardado exclusivamente en este navegador, sin sincronización entre dispositivos. Un registro por día; sin obligación de completarlo ni de repetir comprobaciones.</p>'
  ].join('');
  host.appendChild(panel);
  const $ = id => panel.querySelector('#' + id);
  const stopButton = $('transition-stop');
  const mealButton = $('transition-meal');
  const difficulty = $('transition-difficulty');
  const status = $('transition-status');
  const summary = $('transition-summary');

  function current() { return data.records.find(r => r.day === today()) || null; }
  function save(next) {
    if (locked) return false;
    try {
      const serialized = JSON.stringify(next);
      localStorage.setItem(KEY, serialized);
      if (localStorage.getItem(KEY) !== serialized) return false;
      data = next;
      return true;
    } catch (_) { return false; }
  }
  function update(patch) {
    const day = today();
    const next = {version: 1, records: data.records.map(r => ({...r}))};
    const existing = next.records.find(r => r.day === day);
    if (existing) Object.assign(existing, patch);
    else next.records.push({day, stopAt: patch.stopAt, mealAt: null, difficulty: ''});
    if (!valid(next) || !save(next)) {
      render('No se pudo guardar. No se ha confirmado el registro; comprueba el almacenamiento del navegador.');
      return false;
    }
    return true;
  }
  function inCurrentWeek(day) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    return day >= today(start) && day <= today(now);
  }
  function render(message) {
    const entry = current();
    stopButton.disabled = locked || Boolean(entry);
    mealButton.disabled = locked || !entry || Boolean(entry.mealAt);
    difficulty.disabled = locked || !entry;
    difficulty.value = entry?.difficulty || '';
    if (locked) {
      status.textContent = 'Hay datos anteriores incompatibles o inaccesibles. No se sobrescribirán. Exporta una copia del navegador antes de resolverlo.';
    } else {
      status.textContent = message || (entry
        ? 'Parada registrada a las ' + clock(entry.stopAt) +
          (entry.mealAt ? '. Comida iniciada a las ' + clock(entry.mealAt) + '.' : '. Falta registrar el inicio de la comida.')
        : 'Todavía no hay una parada registrada hoy.');
    }
    const week = data.records.filter(r => inCurrentWeek(r.day));
    const complete = week.filter(r => r.mealAt);
    const inMargin = complete.filter(r => {
      const [y,m,d] = r.day.split('-').map(Number);
      const cutoff = new Date(y, m - 1, d, 14, 10);
      return new Date(r.mealAt) <= cutoff;
    }).length;
    summary.textContent = 'Esta semana: ' + week.length + ' parada(s) registrada(s), ' +
      complete.length + ' comida(s) iniciada(s). ' +
      (complete.length ? inMargin + ' dentro del margen de las 14:10.' : 'Sin datos suficientes para comparar horarios.');
  }

  stopButton.addEventListener('click', () => {
    if (locked || current()) return;
    if (update({stopAt: new Date().toISOString()})) {
      render('Parada guardada a las ' + clock(current().stopAt) + '. Puedes dejar la tarea sin terminar.');
    }
  });
  mealButton.addEventListener('click', () => {
    const entry = current();
    if (locked || !entry || entry.mealAt) return;
    if (update({mealAt: new Date().toISOString()})) {
      render('Inicio de comida guardado a las ' + clock(current().mealAt) + '.');
    }
  });
  difficulty.addEventListener('change', () => {
    const entry = current();
    if (locked || !entry || !CHOICES.includes(difficulty.value)) return;
    const value = difficulty.value;
    if (update({difficulty: value})) render('Dificultad guardada.');
  });
  $('transition-export').addEventListener('click', () => {
    if (locked) {
      render('No se puede exportar desde este módulo porque la copia local no se ha podido interpretar.');
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rumbo-transiciones.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
})();
