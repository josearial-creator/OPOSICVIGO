import test from 'node:test';
import assert from 'node:assert/strict';
import {historyApi} from '../rumbo-worker/history-api.mjs';
import worker from '../rumbo-worker/worker.mjs';
const id='a'.repeat(64),other='b'.repeat(64);
const version={version:1,id,count:132,createdAt:'2026-11-18T13:00:00.000Z',salt:Buffer.alloc(16,1).toString('base64'),iv:Buffer.alloc(12,2).toString('base64'),cipher:Buffer.alloc(500,3).toString('base64')};
const token='history-test-token-very-long-12345678901234';
const origin='https://oposicvigo.vercel.app';
function memoryKv(){
 const rows=new Map();
 return {
  rows,
  async list({prefix,limit=50,cursor}){
   const names=[...rows.keys()].filter(k=>k.startsWith(prefix)).sort();
   const first=cursor?Number(cursor):0,keys=names.slice(first,first+limit).map(name=>({name,metadata:rows.get(name).metadata}));
   return {keys,list_complete:first+limit>=names.length,cursor:String(first+limit)};
  },
  async get(k,format){const v=rows.get(k);return v?(format==='json'?JSON.parse(v.text):v.text):null;},
  async put(k,text,opt={}){rows.set(k,{text,metadata:opt.metadata||{}});},
  async delete(k){rows.delete(k);}
 };
}
const direct=(method,path,body)=>new Request('https://worker.invalid'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
const authenticated=(method,path,body,headers={})=>new Request('https://worker.invalid'+path,{
 method,headers:{Origin:origin,Authorization:'Rumbo '+Buffer.from(token).toString('base64'),...(body?{'Content-Type':'application/json'}:{}),...headers},
 body:body?JSON.stringify(body):undefined
});
test('archivo privado: crear, listar, recuperar y reintentar sin modificar notas',async()=>{
 const kv=memoryKv(),env={NOTES_KV:kv};
 kv.rows.set('private-notes/v1/owner/note1',{text:'TEXTO PRIVADO EXISTENTE',metadata:{}});
 let response=await historyApi(direct('POST','/history',version),env,'/history');
 assert.equal(response.status,201);
 response=await historyApi(direct('GET','/history'),env,'/history');
 const listing=await response.json();
 assert.deepEqual(listing.versions,[{id,count:132,createdAt:version.createdAt}]);
 assert.equal(listing.cursor,null);
 response=await historyApi(direct('GET','/history/'+id),env,'/history/'+id);
 assert.deepEqual((await response.json()).snapshot,version);
 response=await historyApi(direct('POST','/history',version),env,'/history');
 assert.equal(response.status,200);
 response=await historyApi(direct('POST','/history',{...version,cipher:Buffer.alloc(500,4).toString('base64')}),env,'/history');
 assert.equal(response.status,409);
 assert.equal(kv.rows.get('private-history/v1/owner/'+id).text,JSON.stringify(version));
 assert.ok(kv.rows.has('private-notes/v1/owner/note1'));
 assert.equal((await historyApi(direct('DELETE','/history/'+id),env,'/history/'+id)).status,405);
});
test('rechaza datos sin cifrar, tamaños incorrectos y rutas peligrosas',async()=>{
 const kv=memoryKv(),env={NOTES_KV:kv};
 for(const item of [{...version,notes:['datos personales']},{...version,iv:'!'},{...version,count:0},{...version,id:'hola'},{...version,createdAt:'ayer'}]){
  assert.equal((await historyApi(direct('POST','/history',item),env,'/history')).status,400);
 }
 assert.equal((await historyApi(direct('GET','/history/../notes'),env,'/history/../notes')).status,404);
 assert.equal((await historyApi(direct('POST','/history/'+other,version),env,'/history/'+other)).status,405);
 assert.equal(kv.rows.size,0);
});
test('la ruta Worker mantiene autenticación y origen obligatorios',async()=>{
 const env={NOTES_KV:memoryKv(),RUMBO_ACCESS_TOKEN:token,ALLOWED_ORIGIN:origin};
 assert.equal((await worker.fetch(authenticated('GET','/history'),env)).status,200);
 assert.equal((await worker.fetch(authenticated('GET','/history',null,{Authorization:'Bearer incorrecto'}),env)).status,401);
 assert.equal((await worker.fetch(authenticated('GET','/history',null,{Origin:'https://evil.test'}),env)).status,403);
 const allowed=await worker.fetch(authenticated('OPTIONS','/history'),env);
 assert.equal(allowed.status,204);
 assert.equal(allowed.headers.get('Access-Control-Allow-Origin'),origin);
});
test('paginación KV no trunca un historial de muchas versiones',async()=>{
 const kv=memoryKv(),env={NOTES_KV:kv};
 for(let i=0;i<132;i++){
  const code=i.toString(16).padStart(64,'0');
  kv.rows.set('private-history/v1/owner/'+code,{text:JSON.stringify({...version,id:code}),metadata:{count:132,createdAt:version.createdAt}});
 }
 const all=[];let cursor=null;
 do{
  const url='/history'+(cursor?'?cursor='+cursor:'');
  const response=await historyApi(direct('GET',url),env,'/history');
  assert.equal(response.status,200);
  const data=await response.json();
  assert.ok(data.versions.length<=50);all.push(...data.versions);cursor=data.cursor;
 }while(cursor);
 assert.equal(all.length,132);
});
