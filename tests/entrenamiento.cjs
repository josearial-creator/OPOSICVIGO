'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const d=require('../docs/rumbo/entrenamiento-data.js');

test('Garmin CSV separado por comas y encabezados en inglés',()=>{
 const rows=d.delimited('Activity ID,Date,Activity Type,Title,Distance,Time,Avg HR,Max HR\n991,2026-11-05,Running,Easy Run,6.19,44:57,148,186');
 assert.equal(rows.length,1);
 const a=d.normalise(rows[0]);
 assert.equal(a.id,'garmin:991');
 assert.equal(a.distanceKm,6.19);
 assert.equal(a.durationSeconds,2697);
 assert.equal(a.avgHr,148);
 assert.equal(a.date,'2026-11-05');
});

test('Garmin CSV separado por punto y coma y decimales españoles',()=>{
 const rows=d.delimited('Fecha;Tipo de actividad;Distancia;Tiempo;Frecuencia cardíaca media\n05/11/2026;Carrera;6,19;44:57;148');
 assert.equal(rows.length,1);
 const a=d.normalise(rows[0]);
 assert.equal(a.date,'2026-11-05');
 assert.equal(a.distanceKm,6.19);
 assert.equal(a.durationSeconds,2697);
 assert.equal(a.avgHr,148);
});

test('Los campos entrecomillados admiten comas y saltos de línea',()=>{
 const rows=d.delimited('Date,Title,Distance,Time\n2026-11-03,"Test, 10 km",15.08,1:24:00');
 assert.equal(rows.length,1);
 assert.equal(d.normalise(rows[0]).title,'Test, 10 km');
});

test('Fechas erróneas y archivos no reconocidos se rechazan',()=>{
 assert.equal(d.day('31/02/2026'),null);
 assert.equal(d.normalise({date:'31/02/2026',distance:'10',time:'50:00'}),null);
 assert.deepEqual(d.delimited('abc'),[]);
});

test('Importación repetida no duplica una sesión y conserva notas previas',()=>{
 const historic={id:'hist:1',source:'historico-chat',date:'2026-11-05',title:'Rodaje',type:'Carrera',distanceKm:6.19,durationSeconds:2697,avgHr:148,notes:'Pico inicial sospechoso'};
 const garmin={...historic,id:'garmin:776',source:'garmin-csv',avgHr:149,notes:''};
 const x=d.merge([historic],[garmin]);
 assert.equal(x.added,0);
 assert.equal(x.updated,1);
 assert.equal(x.activities.length,1);
 assert.equal(x.activities[0].avgHr,149);
 assert.equal(x.activities[0].notes,historic.notes);
 const again=d.merge(x.activities,[garmin]);
 assert.equal(again.activities.length,1);
});
