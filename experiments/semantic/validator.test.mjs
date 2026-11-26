import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validate,metrics,userMessages} from './validator.mjs';
const p={"dimension":"atencion","direction":"dificultad","kind":"conducta","temporal":"sin fecha precisa","basis":"inferencia","evidence":[{"messageId":"u1","quote":"fui cambiando de ventana"}],"counterevidence":[],"alternative":"También puede haber habido interrupciones externas."};
const m=[{"id":"u1","role":"user","text":"Quería leer el informe, pero fui cambiando de ventana hasta que se terminó el tiempo."}];
test('literalidad y posición',()=>assert.equal(validate(m,{observations:[p]}).accepted[0].evidence[0].start,m[0].text.indexOf(p.evidence[0].quote)));
test('citas falsas, repetidas, de terceros y del asistente no pasan validación de origen',()=>{
 assert.equal(validate(m,{observations:[{...p,evidence:[{messageId:'u1',quote:'frase no presente'}]}]}).rejected.length,1);
 assert.equal(validate([{id:'u1',role:'user',text:'revisé el texto, revisé el texto'}],{observations:[{...p,evidence:[{messageId:'u1',quote:'revisé el texto'}]}]}).rejected.length,1);
 const messages=[{id:'a1',role:'assistant',text:'tienes ansiedad'}];
 assert.deepEqual(userMessages(messages),[]);
 assert.equal(validate(messages,{observations:[{...p,evidence:[{messageId:'a1',quote:'tienes ansiedad'}]}]}).rejected.length,1);
});
test('abstención estructural, duplicados y ausencia de intensidad inferida',()=>{
 for(const q of [{...p,alternative:null},{...p,direction:'mixto'},{...p,intensity:9}])assert.equal(validate(m,{observations:[q]}).rejected.length,1);
 assert.equal(validate(m,{observations:[p,p]}).accepted.length,1);
 assert.equal(validate(m,{observations:[p]}).accepted[0].intensity,null);
});
test('métricas de clasificación',()=>{
 const f=[{id:'x',expected:['atencion:dificultad'],forbidden:['ansiedad:dificultad']}];
 const r=metrics(f,{x:validate(m,{observations:[p]})});
 assert.equal(r.precision,1);assert.equal(r.recall,1);
});
