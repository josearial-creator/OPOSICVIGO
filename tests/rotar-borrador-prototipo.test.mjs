import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {prepareDraftPasswordRotation} from '../docs/rumbo/rotar-borrador-prototipo.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const enc=new TextEncoder(),dec=new TextDecoder();
const t64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const f64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const key=async(password,salt)=>{
 const raw=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:180000,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
};
const old='antigua-clave-ficticia',next='clave-nueva-ficticia-123456';
async function fixture(text){
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(old,salt),enc.encode(text));
 return JSON.stringify({format:2,salt:t64(salt),iv:t64(iv),cipher:t64(cipher)});
}
test('recifrar borrador: conserva contenido y mantiene intacto el original',async()=>{
 const original=await fixture('Este texto es ficticio y debe mantenerse.');
 const {newSaved,plaintextWasVerified}=await prepareDraftPasswordRotation({saved:original,oldPassword:old,newPassword:next});
 assert.equal(plaintextWasVerified,true);assert.notEqual(original,newSaved);
 const data=JSON.parse(newSaved);
 const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:f64(data.iv)},await key(next,f64(data.salt)),f64(data.cipher));
 assert.equal(dec.decode(clear),'Este texto es ficticio y debe mantenerse.');
 assert.equal(JSON.parse(original).format,2);
 const formerKey=await key(old,f64(data.salt));
 await assert.rejects(()=>crypto.subtle.decrypt({name:'AES-GCM',iv:f64(data.iv)},formerKey,f64(data.cipher)));
});
test('contraseña anterior incorrecta: rechaza sin devolver sobrescritura',async()=>{
 const saved=await fixture('conservación');
 await assert.rejects(()=>prepareDraftPasswordRotation({saved,oldPassword:'incorrecta',newPassword:next}),/No se pudo abrir/);
});
test('datos corruptos o contraseña débil: rechaza',async()=>{
 const saved=await fixture('test');
 await assert.rejects(()=>prepareDraftPasswordRotation({saved,oldPassword:old,newPassword:'corta'}),/inválidas/);
 await assert.rejects(()=>prepareDraftPasswordRotation({saved:'{}',oldPassword:old,newPassword:next}),/Formato/);
});
