import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerPasswordStore} from '../rumbo-worker/owner-password-store-prototype.mjs';
const base={account_id:'owner',kdf:'PBKDF2-SHA256',iterations:600000,salt_hex:'a'.repeat(32),verifier_hex:'b'.repeat(64),changed_at:1,auth_version:3};
const next={kdf:'PBKDF2-SHA256',iterations:600000,salt_hex:'c'.repeat(32),verifier_hex:'d'.repeat(64),changed_at:2};
const database=()=>{
 let record={...base};let queries=[];
 const db={withSession:hint=>{queries.push(hint);return db;},prepare:sql=>({first:async()=>({...record}),bind:(...args)=>({run:async()=>{
  const expectedVersion=args[5],expectedHash=args[6],ok=expectedVersion===record.auth_version&&expectedHash===record.verifier_hex;
  if(ok){record={...record,kdf:args[0],iterations:args[1],salt_hex:args[2],verifier_hex:args[3],changed_at:args[4],auth_version:record.auth_version+1};}
  return {success:true,meta:{changes:ok?1:0}};
 }})})};
 return {db,queries,get:()=>record};
};
test('cambio de contraseña incrementa versión de forma atómica',async()=>{
 const {db,queries,get}=database(),store=createOwnerPasswordStore(db);
 const before=await store.current();assert.equal(before.auth_version,3);
 assert.equal(await store.compareAndSwap(before,next),4);
 assert.equal(get().auth_version,4);
 assert.equal(get().verifier_hex,'d'.repeat(64));
 assert.deepEqual(queries,['first-primary','first-primary']);
});
test('cambios concurrentes o repetidos fallan sin sobrescribir nueva clave',async()=>{
 const {db,get}=database(),store=createOwnerPasswordStore(db);
 const old=await store.current();
 await store.compareAndSwap(old,next);
 await assert.rejects(()=>store.compareAndSwap(old,{...next,verifier_hex:'e'.repeat(64)}),/no confirmado/);
 assert.equal(get().verifier_hex,'d'.repeat(64));
 assert.equal(get().auth_version,4);
});
test('datos inválidos y D1 no disponible nunca confirman el cambio',async()=>{
 const {db}=database(),store=createOwnerPasswordStore(db);
 await assert.rejects(()=>store.compareAndSwap({...base,auth_version:0},next));
 await assert.rejects(()=>store.compareAndSwap(base,{...next,verifier_hex:'invalido'}));
 assert.throws(()=>createOwnerPasswordStore(null));
});
