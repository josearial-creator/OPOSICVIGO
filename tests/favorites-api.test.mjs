import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../rumbo-worker/worker.mjs';
import {favoritesApi} from '../rumbo-worker/favorites-api.mjs';
const token='clave-de-prueba-rumbo-solo-tests-1234567890',origin='https://oposicvigo.vercel.app',id='a'.repeat(64);
const snapshot={version:1,id,createdAt:'2026-11-19T08:00:00.000Z',count:2,salt:Buffer.alloc(16,1).toString('base64'),iv:Buffer.alloc(12,2).toString('base64'),cipher:Buffer.alloc(200,3).toString('base64')};
const req=(method,path,payload,headers={})=>new Request('https://worker.test'+path,{method,headers:{Origin:origin,Authorization:'Rumbo '+Buffer.from(token).toString('base64'),...(payload?{'Content-Type':'application/json'}:{}),...headers},body:payload?JSON.stringify(payload):undefined});
function kv(){const m=new Map();return {m,async get(k,kind){const x=m.get(k);return x?(kind==='json'?JSON.parse(x.content):x.content):null;},async put(k,v,{metadata}={}){m.set(k,{content:v,metadata});},async delete(k){m.delete(k);},async list({prefix}){return {keys:[...m.entries()].filter(([k])=>k.startsWith(prefix)).map(([name,value])=>({name,metadata:value.metadata})),list_complete:true}}};}
test('favoritos remotos: solo cifrado, inmutables, sin tocar notas',async()=>{
 const store=kv(),env={NOTES_KV:store};
 store.m.set('private-notes/v1/owner/existing',{content:'TEXTO PRIVADO',metadata:{}});
 assert.equal((await favoritesApi(req('POST','/favorites',snapshot),env,'/favorites')).status,201);
 const list=await favoritesApi(req('GET','/favorites'),env,'/favorites');
 assert.deepEqual((await list.json()).versions,[{id,count:2,createdAt:snapshot.createdAt}]);
 const restored=await favoritesApi(req('GET','/favorites/'+id),env,'/favorites/'+id);
 assert.deepEqual((await restored.json()).snapshot,snapshot);
 assert.equal((await favoritesApi(req('POST','/favorites',snapshot),env,'/favorites')).status,200);
 assert.equal((await favoritesApi(req('POST','/favorites',{...snapshot,count:1}),env,'/favorites')).status,409);
 assert.equal((await favoritesApi(req('DELETE','/favorites/'+id),env,'/favorites/'+id)).status,405);
 assert.equal(store.m.get('private-notes/v1/owner/existing').content,'TEXTO PRIVADO');
});
test('favoritos remotos: no acepta claves en claro ni cuerpo mal formado',async()=>{
 const env={NOTES_KV:kv()};
 for(const bad of [{...snapshot,records:['OPOSICION PRIVADA']},{...snapshot,salt:'?'},
    {...snapshot,cipher:''},{...snapshot,id:'../notes'},{...snapshot,count:-1}]){
   assert.equal((await favoritesApi(req('POST','/favorites',bad),env,'/favorites')).status,400);
 }
 assert.equal((await favoritesApi(req('GET','/favorites/'+id+'/../notes'),env,'/favorites/'+id+'/../notes')).status,404);
 assert.equal(env.NOTES_KV.m.size,0);
});
test('favoritos /favorites: autenticación y CORS obligatorios en Worker',async()=>{
 const env={RUMBO_ACCESS_TOKEN:token,ALLOWED_ORIGIN:origin,NOTES_KV:kv()};
 assert.equal((await worker.fetch(req('GET','/favorites'),env)).status,200);
 assert.equal((await worker.fetch(req('GET','/favorites',null,{Authorization:'Bearer incorrecto'}),env)).status,401);
 assert.equal((await worker.fetch(req('GET','/favorites',null,{Origin:'https://attacker.test'}),env)).status,403);
 const pre=await worker.fetch(req('OPTIONS','/favorites',null,{Authorization:''}),env);
 assert.equal(pre.status,204);
 assert.equal(pre.headers.get('Access-Control-Allow-Origin'),origin);
});
