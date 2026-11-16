import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {passwordPolicy,preparePasswordVerifier,verifyPasswordVerifier,preparePasswordChange} from '../rumbo-worker/password-verifier-prototype.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const first='contraseña-antigua-ficticia',second='contraseña-nueva-ficticia';
test('verificador salado: no almacena contraseña original y valida correctamente',async()=>{
 const record=await preparePasswordVerifier(first,{clock:()=>1234});
 assert.equal(record.kdf,'PBKDF2-SHA256');assert.equal(record.iterations,600000);
 assert.equal(record.salt_hex.length,32);assert.equal(record.verifier_hex.length,64);
 assert.equal(record.changed_at,1234);
 assert.equal(JSON.stringify(record).includes(first),false);
 assert.equal(await verifyPasswordVerifier(first,record),true);
 assert.equal(await verifyPasswordVerifier('incorrecta',record),false);
 assert.equal(await verifyPasswordVerifier(first,{...record,salt_hex:'incorrecto'}),false);
});
test('cambio de contraseña: exige la anterior y confirmación; verifica la nueva',async()=>{
 const old=await preparePasswordVerifier(first);
 await assert.rejects(()=>preparePasswordChange({currentPassword:'incorrecta',newPassword:second,confirmation:second,storedVerifier:old}),/actual/);
 await assert.rejects(()=>preparePasswordChange({currentPassword:first,newPassword:second,confirmation:'otra',storedVerifier:old}),/confirmación/);
 await assert.rejects(()=>preparePasswordChange({currentPassword:first,newPassword:first,confirmation:first,storedVerifier:old}),/diferente/);
 const replacement=await preparePasswordChange({currentPassword:first,newPassword:second,confirmation:second,storedVerifier:old});
 assert.notEqual(replacement.salt_hex,old.salt_hex);
 assert.equal(await verifyPasswordVerifier(second,replacement),true);
 assert.equal(await verifyPasswordVerifier(first,replacement),false);
 assert.equal(await verifyPasswordVerifier(first,old),true,'Preparar no modifica original');
});
test('contraseña permanente con longitud mínima; datos mal formados se rechazan',async()=>{
 assert.equal(passwordPolicy('corta'),false);
 assert.equal(passwordPolicy(' '.repeat(16)),false);
 assert.equal(passwordPolicy(second),true);
 await assert.rejects(()=>preparePasswordVerifier('corta'),/requisitos/);
});
