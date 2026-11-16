import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createPasswordChangeHandler} from '../rumbo-worker/password-change-handler-prototype.mjs';
import {preparePasswordVerifier,verifyPasswordVerifier} from '../rumbo-worker/password-verifier-prototype.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const origin='https://rumbo.test';
const oldPassword='clave-ficticia-antigua-123';
const newPassword='clave-ficticia-nueva-456';
const dbFor=initial=>{
 let row={account_id:'owner',...initial,auth_version:2};
 return {get:()=>row,prepare:sql=>({
  async first(){return {...row};},
  bind(...args){return{async run(){
   const valid=args[5]===row.auth_version&&args[6]===row.verifier_hex;
   if(valid)row={...row,kdf:args[0],iterations:args[1],salt_hex:args[2],verifier_hex:args[3],changed_at:args[4],auth_version:row.auth_version+1};
   return{success:true,meta:{changes:valid?1:0}};
  }}}
 })};
};
const limiter={
 clientId:async()=> 'synthetic-client',
 check:async()=>true,
 recordFailure:async()=>{},
 recordSuccess:async()=>{}
};
const request=(currentPassword,newPass=newPassword,confirmation=newPass,originHeader=origin)=>
 new Request(origin+'/password/change',{method:'POST',headers:{Origin:originHeader,'Content-Type':'application/json','X-Rumbo-CSRF':'synthetic-csrf'},
 body:JSON.stringify({currentPassword,newPassword:newPass,confirmation})});
test('cambio de contraseña autorizado incrementa versión y cierra sesión',async()=>{
 const initial=await preparePasswordVerifier(oldPassword);
 const db=dbFor(initial);
 const handle=createPasswordChangeHandler({db,authorize:async()=>null,limiter});
 const result=await handle(request(oldPassword));
 assert.equal(result.status,200);
 assert.equal((await result.json()).reloginRequired,true);
 assert.match(result.headers.get('Set-Cookie'),/Max-Age=0/);
 assert.equal(db.get().auth_version,3);
 assert.equal(await verifyPasswordVerifier(newPassword,db.get()),true);
 assert.equal(await verifyPasswordVerifier(oldPassword,db.get()),false);
});
test('sin sesión, sin limitador o con contraseña incorrecta no modifica credenciales',async()=>{
 const initial=await preparePasswordVerifier(oldPassword);
 const db=dbFor(initial);
 const denied=createPasswordChangeHandler({db,authorize:async()=>new Response('Unauthorized',{status:401}),limiter});
 assert.equal((await denied(request(oldPassword))).status,401);
 const unprotected=createPasswordChangeHandler({db,authorize:async()=>null});
 assert.equal((await unprotected(request(oldPassword))).status,503);
 const protectedHandler=createPasswordChangeHandler({db,authorize:async()=>null,limiter});
 assert.equal((await protectedHandler(request('incorrecta'))).status,400);
 assert.equal(db.get().auth_version,2);
 assert.equal(db.get().verifier_hex,initial.verifier_hex);
});
test('cambio simultáneo pierde carrera y no anuncia éxito',async()=>{
 const initial=await preparePasswordVerifier(oldPassword);
 const db=dbFor(initial);
 const original=db.prepare.bind(db);
 db.prepare=sql=>{
  const stmt=original(sql);
  if(!sql.startsWith('UPDATE '))return stmt;
  return {bind(...args){const run=stmt.bind(...args).run;return{async run(){
   await new Promise(r=>setTimeout(r,1));
   return run();
  }};}};
 };
 const handle=createPasswordChangeHandler({db,authorize:async()=>null,limiter});
 const results=await Promise.all([handle(request(oldPassword)),handle(request(oldPassword))]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 assert.equal(db.get().auth_version,3);
});
