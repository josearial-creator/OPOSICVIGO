import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {syncCalendar} from '../rumbo-worker/calendar-sync.mjs';

test('autenticación, reintento, cambio de hora, reintento antiguo y agenda vacía', async () => {
  const sql = new DatabaseSync(':memory:');
  const db = {
    prepare(query) { return {query, bind(...args) { return {query,args}; }}; },
    async batch(statements) {
      sql.exec('BEGIN');
      try {
        const result = statements.map(({query,args=[]}) => ({meta:sql.prepare(query).run(...args)}));
        sql.exec('COMMIT');
        return result;
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    }
  };
  const secret = 'x'.repeat(40);
  const event = {source:'google-calendar',calendar_id:'primary',source_event_id:'prueba',
    title:'Cita ficticia',all_day:false,start:'2026-01-10T09:00:00Z',end:'2026-01-10T10:00:00Z'};
  const send = (events, day=1, token=secret) => syncCalendar(new Request('https://example.invalid/calendar/sync',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({captured_at:'2025-01-0'+day+'T00:00:00.000Z',count:events.length,events})
  }), {db,CALENDAR_SYNC_TOKEN:secret}, (status,data)=>({status,...data}), (a,b)=>a===b);
  const read = () => JSON.parse(sql.prepare('SELECT events_json FROM rumbo_calendar_snapshot').get().events_json);
  assert.equal((await send([event],1,'invalid')).status,401);
  assert.equal((await send([event])).applied,true);
  assert.equal((await send([event])).applied,false);
  assert.equal((await send([{...event,start:'2026-01-10T09:30:00Z'}],2)).applied,true);
  assert.equal((await send([event])).applied,false);
  assert.equal((await send([event,event],3)).status,422);
  assert.equal(read().length,1);
  assert.equal(read()[0].start,'2026-01-10T09:30:00Z');
  await send([],3);
  assert.deepEqual(read(),[]);
  sql.close();
});
