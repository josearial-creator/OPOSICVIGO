const {test}=require('node:test'),assert=require('node:assert/strict');
const {nextQuestion}=require('../docs/rumbo/entrevista-psicologia.js');
test('no repite ni pregunta sin permiso',()=>{assert.equal(nextQuestion({}).status,'detenido');assert.equal(nextQuestion({consent:true,known:['situacion'],asked:['interpretacion'],skipped:['emocion']}).id,'conducta');});
test('límite, parada y ausencia de contraste forzado',()=>{assert.equal(nextQuestion({consent:true,asked:['situacion','interpretacion','emocion','conducta']}).status,'resumen');assert.equal(nextQuestion({consent:true,stop:true}).status,'detenido');assert.equal(nextQuestion({consent:true,known:['situacion','interpretacion','emocion','conducta','consecuencia']}).id,'recursos');});
