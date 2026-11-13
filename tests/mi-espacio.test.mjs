import {test} from 'node:test';
import assert from 'node:assert/strict';
import {notesApi} from '../rumbo-worker/notes-api.mjs';
const records=new Map();
const kv={
 async list({prefix}){return {keys:[...records.keys()].filter(x=>x.startsWith(prefix)).map(name=>({name})),list_complete:true};},
 async get(k,type){const s=records.get(k);return type==='json'&&s?JSON.parse(s):s??null;},
 async put(k,v){records.set(k,v);},async delete(k){records.delete(k);}
};
const req=(method,path,data)=>new Request('https://localhost'+path,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
const call=(m,p,d)=>notesApi(req(m,p,d),{NOTES_KV:kv},p);
test('Mi espacio: almacenamiento no configurado falla cerrado',async()=>{const r=await notesApi(req('GET','/notes'),{},'/notes');assert.equal(r.status,503);});
test('Mi espacio: guardar, listar, editar, consultar, borrar y exportabilidad',async()=>{
 records.clear();
 const saved=await call('POST','/notes',{text:'Pensamiento privado'});assert.equal(saved.status,201);
 const {note}=await saved.json();assert.equal(note.text,'Pensamiento privado');
 const list=await (await call('GET','/notes')).json();assert.equal(list.notes.length,1);
 const updated=await (await call('PUT','/notes/'+note.id,{text:'Corregido',mood:'bien'})).json();
 assert.equal(updated.note.mood,'bien');
 assert.equal((await (await call('GET','/notes/'+note.id)).json()).note.text,'Corregido');
 assert.equal((await call('DELETE','/notes/'+note.id)).status,200);
 assert.equal((await (await call('GET','/notes')).json()).notes.length,0);
});
test('Mi espacio: entradas vacías e ids inválidos rechazados',async()=>{
 assert.equal((await call('POST','/notes',{text:'   '})).status,400);
 assert.equal((await call('DELETE','/notes/../../bad')).status,404);
});
test('reintento conserva una sola nota y rechaza contenido distinto sin sobrescribir',async()=>{
 records.clear();const createId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 assert.equal((await call('POST','/notes',{text:'Nota sintética',createId})).status,201);
 assert.equal((await call('POST','/notes',{text:'Nota sintética',createId})).status,200);assert.equal(records.size,1);
 assert.equal((await call('POST','/notes',{text:'Otro contenido',createId})).status,409);
 assert.equal((await (await call('GET','/notes/'+createId)).json()).note.text,'Nota sintética');
 assert.equal((await call('POST','/notes',{text:'x',createId:'../bad'})).status,400);
});
test('reintentos con lectura KV retrasada reutilizan una sola clave',async()=>{
 records.clear();const createId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';const stale={...kv,get:async()=>null};
 for(let i=0;i<2;i++)await notesApi(req('POST','/notes',{text:'Nota sintética',createId}),{NOTES_KV:stale},'/notes');
 assert.equal(records.size,1);
});
