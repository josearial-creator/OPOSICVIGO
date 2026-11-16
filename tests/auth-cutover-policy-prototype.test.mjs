import {test} from 'node:test';
import assert from 'node:assert/strict';
import {choosePrivateAuthMode,enforcePrivateNotesBoundary} from '../rumbo-worker/auth-cutover-policy-prototype.mjs';
const origin='https://rumbo.test';
const request=(path,auth)=>new Request(origin+path,{headers:auth?{Authorization:'Rumbo dummy'}:{}});
test('no se pueden habilitar simultáneamente contraseña maestra antigua y sesiones nuevas',()=>{
 assert.throws(()=>choosePrivateAuthMode({sessionFeatureEnabled:true,legacyNotesEnabled:true,sessionReady:true}),/no coexistir/);
 assert.throws(()=>choosePrivateAuthMode({sessionFeatureEnabled:true,legacyNotesEnabled:false,sessionReady:false}),/faltan/);
 assert.throws(()=>choosePrivateAuthMode({sessionFeatureEnabled:false,legacyNotesEnabled:false,sessionReady:false}),/ninguna/);
});
test('modo antiguo queda intacto antes del corte; tras corte ya no existe bypass Authorization',()=>{
 const legacy=choosePrivateAuthMode({sessionFeatureEnabled:false,legacyNotesEnabled:true,sessionReady:false});
 assert.equal(legacy.notes,'legacy');
 assert.equal(enforcePrivateNotesBoundary(request('/notes',true),legacy),null);
 const modern=choosePrivateAuthMode({sessionFeatureEnabled:true,legacyNotesEnabled:false,sessionReady:true});
 for(const path of ['/notes','/notes/12345678-1234-1234-1234-123456789abc']){
  assert.equal(enforcePrivateNotesBoundary(request(path,true),modern).status,403);
  assert.equal(enforcePrivateNotesBoundary(request(path,false),modern),null);
 }
 assert.equal(enforcePrivateNotesBoundary(request('/chat',true),modern),null);
});
test('modos incompletos o no comprobados fallan cerrado',()=>{
 assert.throws(()=>choosePrivateAuthMode({sessionFeatureEnabled:'true',legacyNotesEnabled:false,sessionReady:true}),/incompleto/);
 assert.throws(()=>enforcePrivateNotesBoundary(request('/notes'),{notes:'unknown'}),/verificado/);
});
