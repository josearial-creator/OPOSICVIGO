const {test}=require('node:test'),assert=require('node:assert/strict');
const engine=require('../docs/rumbo/motor-psicologia.js');
const verifier=require('../docs/rumbo/evidencia-semantica.js');
const {inspect}=require('../docs/rumbo/coordinador-psicologia.js');
const {nextQuestion}=require('../docs/rumbo/entrevista-psicologia.js');
test('evidencia literal y campos sugeridos',()=>{
 const text='Tengo ansiedad. He logrado detenerme.';
 const r=inspect(text,engine,verifier);
 assert.deepEqual(r.hints.map(x=>x.field),['emocion','conducta']);
 for(const p of r.proposals){assert.equal(p.review,'pendiente');assert.equal(p.intensity,null);assert.equal(p.method,'reglas-contextuales-verificadas-1.0');const e=p.evidence[0];assert.equal(text.slice(e.start,e.end),e.quote);}
 assert.equal(nextQuestion({consent:true,known:['situacion','interpretacion',...r.hints.map(x=>x.field)]}).id,'consecuencia');
});
test('sin inventar datos, sin suponer ausencia y sin atribución de terceros',()=>{
 for(const t of ['¿Tengo ansiedad?','Mi amigo dijo que tengo ansiedad.','Compré un libro.','Ayer tengo ansiedad.'])assert.equal(inspect(t,engine,verifier).hints.length,0,t);
 assert.equal(inspect('Tengo ansiedad. Tengo ansiedad.',engine,verifier).hints.length,0);
});
test('desacuerdo entre índice y cita no pasa y fallo de dependencia se abstiene',()=>{
 assert.equal(inspect('Tengo ansiedad.',{analyze:()=>({observations:[{kind:'emoción',index:0,end:5,match:'invento'}]})},verifier).hints.length,0);
 assert.equal(inspect('Tengo ansiedad.',null,verifier).hints.length,0);
});
