// One authoritative, seven-day snapshot from the primary Google Calendar.
// Empty successful reads clear this snapshot. Other Rumbo data lives separately.
const maxBytes = 192 * 1024;
const createTable = `CREATE TABLE IF NOT EXISTS rumbo_calendar_snapshot (
  calendar_id TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL,
  events_json TEXT NOT NULL
)`;
const saveSnapshot = `INSERT INTO rumbo_calendar_snapshot VALUES (?, ?, ?)
  ON CONFLICT(calendar_id) DO UPDATE SET captured_at = excluded.captured_at,
  events_json = excluded.events_json
  WHERE excluded.captured_at > rumbo_calendar_snapshot.captured_at`;

function normalizeEvent(event) {
  if (!event || event.source !== 'google-calendar' || event.calendar_id !== 'primary' ||
      typeof event.source_event_id !== 'string' || !event.source_event_id.length ||
      event.source_event_id.length > 1024 || typeof event.title !== 'string' ||
      event.title.length > 4096 || typeof event.all_day !== 'boolean') return null;
  const pattern = event.all_day ? /^\d{4}-\d\d-\d\d$/ :
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/;
  if (![event.start,event.end].every(value => typeof value === 'string' &&
      pattern.test(value) && Number.isFinite(Date.parse(value))) ||
      Date.parse(event.end) < Date.parse(event.start)) return null;
  return {id:event.source_event_id, title:event.title, start:event.start, end:event.end, all_day:event.all_day};
}

export async function syncCalendar(request, env, reply, equalSecret) {
  if (request.method !== 'POST') return reply(405, {error:'Método no permitido'});
  const secret = env.CALENDAR_SYNC_TOKEN;
  if (!secret || secret.length < 32 || !env.db) return reply(503, {error:'Sincronización sin configurar'});
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || auth.length > 512 || !await equalSecret(auth.slice(7), secret))
    return reply(401, {error:'Acceso no autorizado'});
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json')
    return reply(415, {error:'Se requiere JSON'});
  let payload;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply(400, {error:'Falta el cuerpo'});
    const chunks = [];
    let size = 0;
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return reply(413, {error:'Agenda demasiado grande'}); }
      chunks.push(value);
    }
    payload = JSON.parse(await new Blob(chunks).text());
  } catch { return reply(400, {error:'JSON inválido'}); }
  const captured = Date.parse(payload?.captured_at);
  if (!Number.isFinite(captured) || captured > Date.now() + 60000 ||
      typeof payload.captured_at !== 'string' || new Date(captured).toISOString() !== payload.captured_at ||
      !Array.isArray(payload.events) || payload.events.length !== payload.count ||
      payload.events.length > 1000) return reply(422, {error:'Instantánea inválida'});
  const events = payload.events.map(normalizeEvent);
  if (events.some(event => !event) || new Set(events.map(event => event.id)).size !== events.length)
    return reply(422, {error:'Citas inválidas o identificadores repetidos'});
  try {
    const [,saved] = await env.db.batch([
      env.db.prepare(createTable),
      env.db.prepare(saveSnapshot).bind('primary', payload.captured_at, JSON.stringify(events))
    ]);
    return reply(200, {applied:saved.meta.changes === 1, count:events.length});
  } catch { return reply(503, {error:'No se pudo guardar la agenda'}); }
}
