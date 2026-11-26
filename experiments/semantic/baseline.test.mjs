import {test} from 'node:test';
import assert from 'node:assert/strict';
import {baseline} from './baseline.mjs';
test('referencia de reglas sobre casos explícitos y ausencia de datos',()=>{
 const f=[{id:'a',messages:[{id:'u1',role:'user',text:'Tengo ansiedad.'}],expected:['ansiedad:dificultad'],forbidden:[]},{id:'b',messages:[{id:'u1',role:'user',text:'Compré un libro.'}],expected:[],forbidden:['ansiedad:dificultad']},{id:'c',messages:[{id:'a1',role:'assistant',text:'Tengo ansiedad.'}],expected:[],forbidden:['ansiedad:dificultad']}];
 const r=baseline(f);
 assert.equal(r.metrics.tp,1);assert.equal(r.metrics.fp,0);assert.equal(r.metrics.fn,0);assert.equal(r.metrics.forbidden,0);
});
test('orientación mixta entre mensajes de usuario',()=>{
 const f=[{id:'a',messages:[{id:'u1',role:'user',text:'No he logrado detenerme.'},{id:'u2',role:'user',text:'He logrado detenerme.'}],expected:['inhibicion:mixto'],forbidden:[]}];
 assert.equal(baseline(f).metrics.tp,1);
});
