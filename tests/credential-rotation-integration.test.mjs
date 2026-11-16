// Prueba de integración aislada: ningún dato real, Cloudflare o contraseña privada.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createPrivateGateway} from '../rumbo-worker/private-gateway-prototype.mjs';
import {createOwnerPasswordStore} from '../rumbo-worker/owner-password-store-prototype.mjs';
import {preparePasswordVerifier,verifyPasswordVerifier} from '../rumbo-worker/password-verifier-prototype.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const origin='https://rumbo.test',clock=()=>Date.UTC(2026,10,16);
const oldPassword='clave-anterior-de-pruebas-123',newPassword='clave-nueva-de-pruebas-456';
function makeDb(initial){
 let owner={account_id:'owner',...initial,auth_version:1},notesCalls=0;
 const sessions=new Map();
 const db={
  withSession:()=>db,
  prepare(sql){return{
   async first(){
    if(sql.includes('rumbo_private_password_v1'))return {...owner};
    throw Error('Unexpected unbound SELECT');
   },
   bind(...args){return{
    async first(){
     if(sql.includes('rumbo_auth_sessions_v1')){
      const r=sessions.get(args[0]);return r?{csrf_token:r.csrf,expires_at:r.expiresAt,auth_version:r.authVersion}:null;
     }
     throw Error('Unexpected bound SELECT');
    },
    async run(){
     if(sql.startsWith('INSERT INTO rumbo_auth_sessions_v1')){
      sessions.set(args[0],{csrf:args[1],expiresAt:args[2],authVersion:args[4]});
      return{success:true,meta:{changes:1}};
     }
     if(sql.startsWith('DELETE FROM rumbo_auth_sessions_v1')){sessions.delete(args[0]);return{success:true,meta:{changes:1}};}
     if(sql.startsWith('UPDATE rumbo_private_password_v1')){
      const success=args[5]===owner.auth_version&&args[6]===owner.verifier_hex;
      if(success)owner={...owner,kdf:args[0],iterations:args[1],salt_hex:args[2],verifier_hex:args[3],changed_at:args[4],auth_version:owner.auth_version+1};
      return{success:true,meta:{changes:success?1:0}};
     }
     throw Error('Unexpected mutation');
    }
   };}
  };},
 };
 return {db,sessions,getOwner:()=>owner,notesHandler:async()=>{notesCalls++;return Response.json({notes:[{text:'solo pruebas'}]});},getCalls:()=>notesCalls};
}
function req(path,method='GET',cookie='',csrf='',body){
 const headers={...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-Rumbo-CSRF':csrf}:{})};
 if(method!=='GET'){headers.Origin=origin;headers['Content-Type']='application/json';}
 return new Request(origin+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
}
const limiter={clientId:async()=> 'testing-only',check:async()=>true,recordFailure:async()=>{},recordSuccess:async()=>{}};
test('contraseña personal: login, cambio, revocación total, login nuevo y notas intactas',async()=>{
 const initial=await preparePasswordVerifier(oldPassword);
 const data=makeDb(initial),credentials=createOwnerPasswordStore(data.db);
 const gateway=createPrivateGateway({
  db:data.db,notesEnv:{NOTES_KV:{}},secret:null,apiOrigin:origin,clock,
  verifyLogin:async password=>verifyPasswordVerifier(password,await credentials.current()),
  currentAuthVersion:async()=>(await credentials.current()).auth_version,
  passwordChangeLimiter:limiter,notesHandler:data.notesHandler
 });
 const oldLogin=await gateway(req('/session/login','POST','','',{password:oldPassword}));
 assert.equal(oldLogin.status,200);
 const oldCookie=oldLogin.headers.get('Set-Cookie').split(';')[0],{csrf}=await oldLogin.json();
 assert.equal((await gateway(req('/notes','GET',oldCookie))).status,200);
 const before=data.getCalls();
 // Ausencia CSRF: debe denegarse sin cambiar credenciales ni cerrar sesión.
 assert.equal((await gateway(req('/password/change','POST',oldCookie,'',{currentPassword:oldPassword,newPassword,confirmation:newPassword}))).status,403);
 assert.equal(data.getOwner().auth_version,1);
 // Contraseña equivocada: no debe cambiar versión ni acceso.
 assert.equal((await gateway(req('/password/change','POST',oldCookie,csrf,{currentPassword:'incorrecta',newPassword,confirmation:newPassword}))).status,400);
 assert.equal(data.getOwner().auth_version,1);
 const change=await gateway(req('/password/change','POST',oldCookie,csrf,{currentPassword:oldPassword,newPassword,confirmation:newPassword}));
 assert.equal(change.status,200);
 assert.equal(data.getOwner().auth_version,2);
 assert.equal((await gateway(req('/session','GET',oldCookie))).status,401);
 assert.equal((await gateway(req('/notes','GET',oldCookie))).status,401);
 assert.equal((await gateway(req('/session/login','POST','','',{password:oldPassword}))).status,401);
 assert.equal((await gateway(req('/session/login','POST','','',{password:newPassword}))).status,200);
 const latest=(await gateway(req('/session/login','POST','','',{password:newPassword}))).headers.get('Set-Cookie').split(';')[0];
 assert.equal((await gateway(req('/notes','GET',latest))).status,200);
 assert.equal(data.getCalls(),before+1,'El diario ficticio solo recibió las dos lecturas autorizadas');
});
