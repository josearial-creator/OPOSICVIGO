import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createNotesSessionGuard} from '../rumbo-worker/notes-session-guard.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const site='https://rumbo.test',cookieId='a'.repeat(64),csrf='b'.repeat(64),now=Date.UTC(2026,10,16);
const cookie='__Host-rumbo-session='+cookieId;
const req=(method='GET',headers={})=>new Request(site+'/notes',{method,headers:{Cookie:cookie,...headers}});
const store={get:async()=>({csrf,expiresAt:now+60_000})};
test('session notes guard: same-origin GET autorizado y ninguna nota modificada',async()=>{
 const guard=createNotesSessionGuard({store,apiOrigin:site,clock:()=>now});
 assert.equal(await guard(req()),null);
 assert.equal(await guard(req('GET',{Origin:site})),null);
});
test('session notes guard: modificaciones requieren Origin y CSRF',async()=>{
 const guard=createNotesSessionGuard({store,apiOrigin:site,clock:()=>now});
 for(const method of ['POST','PUT','DELETE']){
  assert.equal((await guard(req(method))).status,403);
  assert.equal((await guard(req(method,{Origin:site}))).status,403);
  assert.equal((await guard(req(method,{Origin:'https://evil.test','X-Rumbo-CSRF':csrf}))).status,403);
  assert.equal(await guard(req(method,{Origin:site,'X-Rumbo-CSRF':csrf})),null);
 }
});
test('session notes guard: sin cookie, vencida, revocada o dominio ajeno deniega',async()=>{
 const guard=createNotesSessionGuard({store,apiOrigin:site,clock:()=>now});
 assert.equal((await guard(new Request(site+'/notes'))).status,401);
 assert.equal((await guard(new Request('https://evil.test/notes',{headers:{Cookie:cookie}}))).status,403);
 const expired=createNotesSessionGuard({store,apiOrigin:site,clock:()=>now+60_001});
 assert.equal((await expired(req())).status,401);
 const revoked=createNotesSessionGuard({store:{get:async()=>null},apiOrigin:site,clock:()=>now});
 assert.equal((await revoked(req())).status,401);
 assert.throws(()=>createNotesSessionGuard({store:null,apiOrigin:site}));
});
test('session notes guard: fallo del almacenamiento no autoriza acceso',async()=>{
 const guard=createNotesSessionGuard({store:{get:async()=>{throw new Error('D1 no disponible')}},apiOrigin:site,clock:()=>now});
 await assert.rejects(()=>guard(req()),/D1 no disponible/);
});

test('sesión anterior queda revocada tras cambio de versión de contraseña',async()=>{
 let version=3;
 const versionedStore={get:async()=>({csrf,expiresAt:now+60_000,authVersion:3})};
 const guard=createNotesSessionGuard({store:versionedStore,apiOrigin:site,clock:()=>now,currentAuthVersion:async()=>version});
 assert.equal(await guard(req('GET')),null);
 version=4;
 assert.equal((await guard(req('GET'))).status,401);
 assert.equal((await guard(req('DELETE',{Origin:site,'X-Rumbo-CSRF':csrf}))).status,401);
});
test('fallo en consultar versión actual no concede acceso a notas',async()=>{
 const store={get:async()=>({csrf,expiresAt:now+60_000,authVersion:1})};
 const guard=createNotesSessionGuard({store,apiOrigin:site,clock:()=>now,currentAuthVersion:async()=>{throw Error('D1 fuera de servicio');}});
 await assert.rejects(()=>guard(req()),/D1 fuera de servicio/);
});
