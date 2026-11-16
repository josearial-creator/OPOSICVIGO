import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPersistentNotesClient} from '../docs/rumbo/sesion-persistente-prototipo.js';
const secret='SYNTHETIC-PASSWORD-ONLY-12345',csrf='b'.repeat(64),expiry=Date.UTC(2026,11,16);
test('cliente: login, recarga y acceso a notas mantienen cookie pero no contraseña',async()=>{
 const sent=[];
 const transport=async(path,init)=>{
  sent.push({path,init});
  if(path.endsWith('/session/login'))return Response.json({authenticated:true,csrf,expiresAt:expiry});
  if(path.endsWith('/session'))return Response.json({authenticated:true,csrf,expiresAt:expiry});
  if(path.endsWith('/notes'))return Response.json({notes:[{text:'synthetic'}]});
  return Response.json({error:'Ruta inválida'},{status:404});
 };
 const first=createPersistentNotesClient({transport});
 assert.deepEqual(await first.login(secret),{authenticated:true,expiresAt:expiry});
 assert.equal(first.draftUnlocked,false);
 assert.equal(first.expiry,expiry);
 const second=createPersistentNotesClient({transport});
 assert.deepEqual(await second.resume(),{authenticated:true,expiresAt:expiry});
 assert.deepEqual((await second.notes()).notes,[{text:'synthetic'}]);
 assert.ok(sent.every(x=>x.init.credentials==='same-origin'));
 assert.ok(sent.every(x=>x.init.redirect==='error'));
 assert.ok(sent.every(x=>!x.init.headers.Authorization));
 assert.equal(JSON.stringify(sent.slice(1)).includes(secret),false);
 assert.equal(JSON.stringify(first).includes(secret),false);
});
test('cliente: escrituras exigen CSRF y sesión restablecida; rutas cerradas',async()=>{
 const sent=[];
 const transport=async(path,init)=>{
  sent.push({path,init});
  if(path.endsWith('/session'))return Response.json({authenticated:true,csrf,expiresAt:expiry});
  return Response.json({note:{id:'synthetic'}});
 };
 const client=createPersistentNotesClient({transport});
 await assert.rejects(()=>client.notes('','POST',{text:'x'}),/CSRF/);
 await client.resume();
 await client.notes('','POST',{text:'x'});
 assert.equal(sent.at(-1).init.headers['X-Rumbo-CSRF'],csrf);
 await assert.rejects(()=>client.notes('/../../chat'),/Ruta privada/);
 await assert.rejects(()=>client.notes('','PATCH'),/Método privado/);
});
test('cliente: logout limpia el estado local, borrador sigue bloqueado',async()=>{
 let count=0;
 const transport=async(path)=>{
  count++;
  if(path.endsWith('/session'))return Response.json({authenticated:true,csrf,expiresAt:expiry});
  return Response.json({authenticated:false});
 };
 const c=createPersistentNotesClient({transport});
 await c.resume();assert.equal(c.expiry,expiry);
 await c.logout();assert.equal(c.expiry,0);assert.equal(c.draftUnlocked,false);
 await assert.rejects(()=>c.notes('','POST',{text:'x'}),/CSRF/);
 assert.equal(count,2);
});
test('cliente: reanudación fallida no afirma autenticación ni descifra borrador',async()=>{
 const c=createPersistentNotesClient({transport:async()=>Response.json({error:'Sesión caducada'},{status:401})});
 assert.deepEqual(await c.resume(),{authenticated:false});
 assert.equal(c.expiry,0);assert.equal(c.draftUnlocked,false);
});
