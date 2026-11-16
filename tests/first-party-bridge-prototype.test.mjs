import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFirstPartyProxy,createInternalWorkerBridge} from '../rumbo-worker/first-party-bridge-prototype.mjs';
import {createPrivateGateway} from '../rumbo-worker/private-gateway-prototype.mjs';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const publicOrigin='https://rumbo.example.test',workerOrigin='https://worker.example.test';
const serviceSecret='test-private-service-secret-000000000000000000';
const password='synthetic-password-1234567890123456789';
const time=Date.UTC(2026,10,16);
const records=new Map();
const db={prepare(sql){return {bind(...a){return{
 async first(){const r=records.get(a[0]);return r?{csrf_token:r.csrf,expires_at:r.expiresAt}:null;},
 async run(){if(sql.startsWith('INSERT '))records.set(a[0],{csrf:a[1],expiresAt:a[2]});
 else if(sql.includes('token_hash'))records.delete(a[0]);return{success:true};}
};}};}};
function make(){
 const calls=[];
 const gateway=createPrivateGateway({db,notesEnv:{NOTES_KV:{}},secret:password,apiOrigin:publicOrigin,clock:()=>time,
 notesHandler:async(req,_env,path)=>{calls.push({method:req.method,path,auth:req.headers.has('X-Rumbo-Service-Auth')});
 return Response.json({notes:[{id:'only-synthetic'}]});}});
 const bridge=createInternalWorkerBridge({publicOrigin,workerOrigin,serviceSecret,gateway});
 const proxy=createFirstPartyProxy({publicOrigin,workerOrigin,serviceSecret,transport:bridge});
 return {proxy,bridge,calls};
}
const req=(path,method='GET',headers={},body)=>new Request(publicOrigin+path,{method,headers:{...(method==='GET'?{}:{Origin:publicOrigin,'Content-Type':'application/json'}),...headers},body:body?JSON.stringify(body):undefined});
test('puerta: no se puede llamar al Worker directamente sin credencial del proxy',async()=>{
 const {bridge,calls}=make();
 const direct=new Request(workerOrigin+'/internal/rumbo/notes');
 assert.equal((await bridge(direct)).status,403);
 assert.equal(calls.length,0);
});
test('puerta: login y notas sintéticas usando cookie first-party y CSRF',async()=>{
 records.clear();const {proxy,calls}=make();
 const login=await proxy(req('/api/rumbo/session/login','POST',{}, {password}));
 assert.equal(login.status,200);
 const cookie=login.headers.get('Set-Cookie');
 assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
 const data=await login.json();
 const get=await proxy(req('/api/rumbo/notes','GET',{Cookie:cookie.split(';')[0]}));
 assert.equal(get.status,200);
 assert.equal((await get.json()).notes[0].id,'only-synthetic');
 assert.equal((await proxy(req('/api/rumbo/notes','POST',{Cookie:cookie.split(';')[0]}, {text:'synthetic'}))).status,403);
 assert.equal((await proxy(req('/api/rumbo/notes','POST',{Cookie:cookie.split(';')[0],'X-Rumbo-CSRF':data.csrf},{text:'synthetic'}))).status,200);
 assert.equal(calls.length,2);
 assert.equal(calls[0].auth,false,'internal credential must never reach notes handler');
 assert.equal((await proxy(req('/api/rumbo/session/logout','POST',{Cookie:cookie.split(';')[0],'X-Rumbo-CSRF':data.csrf},{}))).status,200);
 assert.equal((await proxy(req('/api/rumbo/notes','GET',{Cookie:cookie.split(';')[0]}))).status,401);
});
test('puerta: rechaza origen ajeno, rutas extrañas, host incorrecto y cabeceras falsificadas',async()=>{
 const {proxy,calls}=make();
 assert.equal((await proxy(req('/api/rumbo/notes','POST',{Origin:'https://evil.test'},{text:'x'}))).status,403);
 assert.equal((await proxy(req('/api/rumbo/notes/../../chat'))).status,404);
 assert.equal((await proxy(req('/api/rumbo/notes?x=1'))).status,404);
 assert.equal((await proxy(new Request('https://evil.test/api/rumbo/notes'))).status,404);
 assert.equal(calls.length,0);
});
test('puerta: limpia cabeceras no autorizadas y deniega redirecciones',async()=>{
 let forwarded;
 const proxy=createFirstPartyProxy({publicOrigin,workerOrigin,serviceSecret,transport:async req=>{
  forwarded=req.headers;
  return new Response(null,{status:302,headers:{Location:'https://evil.test'}});
 }});
 const response=await proxy(req('/api/rumbo/notes','GET',{'X-Forwarded-Host':'evil.test','X-Rumbo-Service-Auth':'pretend','Authorization':'Bearer evil','Cookie':'other=x; __Host-rumbo-session='+'a'.repeat(64)}));
 assert.equal(response.status,502);
 assert.equal(forwarded.get('X-Rumbo-Service-Auth'),serviceSecret);
 assert.equal(forwarded.get('X-Forwarded-Host'),null);
 assert.equal(forwarded.get('Authorization'),null);
 assert.equal(forwarded.get('Cookie'),'__Host-rumbo-session='+'a'.repeat(64));
});
