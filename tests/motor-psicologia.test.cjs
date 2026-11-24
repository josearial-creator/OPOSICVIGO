const {test}=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../docs/rumbo/motor-psicologia.js');
const observations=text=>engine.analyze(text).observations;
test('dificultad y recurso, misma dimensión sin puntuación',()=>{
 const text='No he conseguido detenerme, pero he logrado detenerme.';
 const rows=observations(text);
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>x.direction),['dificultad','recurso']);
 for(const row of rows){assert.equal(text.slice(row.index,row.end),row.match);assert.equal(row.value,undefined);}
 const [mixed]=engine.uniqueByDimension(text);
 assert.equal(mixed.direction,'mixto');assert.equal(text.slice(mixed.additionalEvidence.index,mixed.additionalEvidence.end),mixed.additionalEvidence.match);
});
test('negación explícita no se confunde con síntoma ni puntuación',()=>{
 assert.deepEqual(observations('No tengo ansiedad.').map(x=>x.direction),['ausencia referida']);
 assert.equal(observations('Nunca tengo ansiedad.').length,0);
 assert.deepEqual(observations('No soy capaz de terminar.').map(x=>x.direction),['dificultad']);
});
test('abstención en preguntas, terceros, ironía señalada e hipótesis',()=>{
 for(const text of ['¿Tengo ansiedad?','Mi amigo dijo que tengo ansiedad.','Si tengo ansiedad, pararé.','Irónicamente, tengo ansiedad.','Quizás tengo ansiedad.','Mañana tengo miedo.','Mi amigo dijo: «Tengo ansiedad».']){
  assert.equal(observations(text).length,0,text);
 }
});
test('temporalidad y multietiqueta',()=>{
 const old=observations('Ayer tuve dificultades y me siento triste.');
 assert.equal(old[0].temporal,'pasado referido');
 const text='Me siento derrotado y necesito resolverlo ya.';
 assert.deepEqual(engine.uniqueByDimension(text).map(x=>x.dimension).sort(),['indefension','urgencia']);
});
test('patrones: mínimo de tres días distintos y cobertura sin inferir síntomas',()=>{
 const row=(date,dimension,extra={})=>({date,dimension,source:'texto',analysis:{direction:'dificultad',temporal:'no especificado',dateBasis:'registro original',...extra}});
 const entries=[];
 for(const date of ['2026-01-01','2026-01-02','2026-01-03'])entries.push(row(date,'urgencia'),row(date,'atencion'));
 entries.push(row('2026-01-03','atencion'),row('2026-01-04','urgencia'),row('2026-01-05','atencion'),row('2026-01-06','urgencia',{temporal:'pasado referido'}),row('2026-01-07','atencion',{dateBasis:'fecha de registro'}));
 const [p]=engine.patterns(entries);
 assert.equal(p.both,3);assert.equal(p.onlyA,1);assert.equal(p.onlyB,1);assert.equal(p.days,5);
 assert.equal(engine.patterns(entries.slice(0,4)).length,0);
});
