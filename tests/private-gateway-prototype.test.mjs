import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createPrivateGateway} from '../rumbo-worker/private-gateway-prototype.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const site='https://rumbo.test', secret='synthetic-only-test-password-12345678901234';
function fakeD1(){
 const rows=new Map();
 return {rows,prepare(sql){return{bind(...args){return{
  async first(){const r=rows.get(args[0]);return r?{csrf_token:r.csrf,expires_at:r.expiresAt}:null;},
  async run(){if(sql.startsWith('INSERT ')){rows.set(args[0],{csrf:args[1],expiresAt:args[2]});}
   else if(sql.includes('token_hash'))rows.delete(args[0]);
   else for(const [k,v] of rows)if(v.expiresAt<=args[0])rows.delete(k);
   return{success:true};}
 };}};}};
}
const build=()=>{
 const calls=[];const db=fakeD1();
 const gateway=createPrivateGateway({db,notesEnv:{NOTES_KV:{}},secret,apiOrigin:site,
  clock:()=>Date.UTC(2026,10,16),notesHandler:async(request,env,path)=>{calls.push({method:request.method,path});return Response.json({notes:[{id:'synthetic-only'}]});}});
 return{gateway,calls,db};
};
const request=(path,method='GET',{cookie='',csrf='',origin=site,password=secret}={})=>
 new Request(site+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-Rumbo-CSRF':csrf}:{}),...(method==='POST'||method==='PUT'||method==='DELETE'?{Origin:origin,'Content-Type':'application/json'}:{})},
  ...(method==='POST'||method==='PUT'?{body:JSON.stringify(path==='/session/login'?{password}:{text:'synthetic only'})}:{})});
test('gateway: invalid login, missing cookie, wrong origin cannot touch private notes',async()=>{
 const {gateway,calls}=build();
 assert.equal((await gateway(request('/session/login','POST',{password:'incorrect'}))).status,401);
 assert.equal((await gateway(request('/notes'))).status,401);
 assert.equal((await gateway(request('/notes','DELETE',{origin:'https://evil.test'}))).status,403);
 assert.equal(calls.length,0);
});
test('gateway: session validates reads, enforces CSRF on writes, revokes on logout',async()=>{
 const {gateway,calls,db}=build();
 const login=await gateway(request('/session/login','POST'));
 assert.equal(login.status,200);
 const cookie=login.headers.get('Set-Cookie').split(';')[0],{csrf}=await login.json();
 const list=await gateway(request('/notes','GET',{cookie}));
 assert.equal(list.status,200);
 assert.deepEqual((await list.json()).notes,[{id:'synthetic-only'}]);
 assert.equal((await gateway(request('/notes','POST',{cookie,csrf:'bad'}))).status,403);
 assert.equal(calls.length,1);
 assert.equal((await gateway(request('/notes','POST',{cookie,csrf}))).status,200);
 assert.equal(calls.length,2);
 assert.equal((await gateway(request('/session/logout','POST',{cookie,csrf}))).status,200);
 assert.equal(db.rows.size,0);
 assert.equal((await gateway(request('/notes','GET',{cookie}))).status,401);
 assert.equal(calls.length,2,'Revoked session cannot reach notes backend');
});
test('gateway: missing D1 schema fails closed with no notes handler invocation',async()=>{
 let count=0;
 const db={prepare:()=>({bind:()=>({first:async()=>{throw Error('no such table');}})})};
 const gateway=createPrivateGateway({db,notesEnv:{NOTES_KV:{}},secret,apiOrigin:site,notesHandler:async()=>{count++;return Response.json({});}});
 const response=await gateway(request('/notes','GET',{cookie:'__Host-rumbo-session='+'a'.repeat(64)}));
 assert.equal(response.status,503);assert.equal(count,0);
});
