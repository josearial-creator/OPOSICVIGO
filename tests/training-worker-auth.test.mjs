import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../rumbo-worker/worker.mjs';

const origin='https://oposicvigo.vercel.app';
const token='test-passphrase-32-characters-minimum-xxxxxxxxx';
const env=()=>{
 const stored=new Map();
 return {ALLOWED_ORIGIN:origin,RUMBO_ACCESS_TOKEN:token,NOTES_KV:{
  async list({prefix}){return {keys:[...stored.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true};},
  async get(key,format){const v=stored.get(key);return format==='json'&&v?JSON.parse(v):v??null;},
  async put(k,v){stored.set(k,v);},
  async delete(k){stored.delete(k);}
 },stored};
};
const id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const record={version:1,id,date:'2026-11-16T13:00:00.000Z',salt:Buffer.alloc(16,4).toString('base64'),iv:Buffer.alloc(12,5).toString('base64'),cipher:Buffer.alloc(32,6).toString('base64')};
const request=(path,{method='GET',password=token,from=origin,body}={})=>new Request('https://example.workers.dev'+path,{method,headers:{Origin:from,...(password?{Authorization:'Rumbo '+Buffer.from(password).toString('base64')}:{}) ,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});

test('sin credenciales válidas no se pueden consultar registros',async()=>{
 const e=env();
 for(const bad of [undefined,'clave incorrecta']){
  const res=await worker.fetch(request('/training',{password:bad??''}),e);
  assert.equal(res.status,401);
 }
 assert.equal((await worker.fetch(request('/training',{from:'https://ejemplo-malicioso.com'}),e)).status,403);
 assert.equal((await worker.fetch(request('/training',{password:token}),e)).status,200);
});
test('rutas de Entrenamiento aisladas y registro sin texto legible',async()=>{
 const e=env();
 e.stored.set('private-notes/v1/owner/'+id,JSON.stringify({text:'NO MODIFICAR DIARIO'}));
 const res=await worker.fetch(request('/training',{method:'POST',body:record}),e);
 assert.equal(res.status,201);
 const saved=e.stored.get('private-training/v1/owner/'+id);
 assert.ok(saved);
 assert.equal(saved.includes('pensamiento'),false);
 assert.equal(saved.includes('NO MODIFICAR DIARIO'),false);
 const list=await worker.fetch(request('/training'),e);
 assert.equal(list.status,200);
 assert.equal((await list.json()).records.length,1);
 const del=await worker.fetch(request('/training/'+id,{method:'DELETE'}),e);
 assert.equal(del.status,200);
 assert.equal(e.stored.has('private-notes/v1/owner/'+id),true);
 assert.equal(e.stored.has('private-training/v1/owner/'+id),false);
});
