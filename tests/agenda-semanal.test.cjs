const {test}=require('node:test'),assert=require('node:assert/strict');
const {agendaRows,dayOf,plus}=require('../docs/rumbo/agenda-semanal.js');
const all=(title,start,end)=>({title,start,end,all_day:true});
const timed=(title,start,end)=>({title,start,end,all_day:false});
test('ventana de 7 días y fechas inválidas',()=>{
 const rows=agendaRows([all('Ayer','2026-11-25','2026-11-26'),all('Hoy','2026-11-26','2026-11-27'),all('Último','2026-12-02','2026-12-03'),all('Fuera','2026-12-03','2026-12-04'),all('Inválida','2026-11-31','2026-12-02')],'2026-11-26');
 assert.deepEqual(rows.map(r=>r.title),['Hoy','Último']);
 assert.equal(agendaRows([all('Hoy','2026-11-26','2026-11-27')],'2026-11-27').length,0);
});
test('orden cronológico con distintos offsets y evento en curso',()=>{
 const rows=agendaRows([timed('Tarde','2026-11-26T08:30:00Z','2026-11-26T09:30:00Z'),timed('Temprano','2026-11-26T09:00:00+02:00','2026-11-26T10:00:00+02:00'),timed('En curso','2026-11-25T20:00:00Z','2026-11-26T02:00:00Z'),all('Todo el día','2026-11-26','2026-11-27')],'2026-11-26');
 assert.deepEqual(rows.map(r=>r.title),['Todo el día','En curso','Temprano','Tarde']);
 assert.equal(rows[1].hour,'En curso');assert.equal(rows[2].hour,'08:00');
});
test('medianoche de Madrid, cambios de horario y año',()=>{
 assert.equal(dayOf(new Date('2026-11-25T23:00:00Z')),'2026-11-26');
 assert.equal(dayOf(new Date('2026-07-01T22:00:00Z')),'2026-07-02');
 assert.equal(plus('2026-12-31',1),'2027-01-01');
 assert.equal(plus('2026-03-29',1),'2026-03-30');
});
