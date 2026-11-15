import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createSessionApi} from '../rumbo-worker/session-prototype.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const origin='https://rumbo.example.test',secret='ficticio-solo-test-0123456789abcdefghijklmn';
const create=()=>{
 const entries=new Map();let now=Date.UTC(2026,10,15);
 const store={get:async k=>entries.get(k),put:async(k,v)=>{entries.set(k,v);},delete:async k=>{entries.delete(k);}};
 return {entries,setTime:n=>now=n,clock:()=>now,api:createSessionApi({store,secret,apiOrigin:origin,clock:()=>now})};
};
const req=(path,method='GET',{cookie='',csrf='',password=secret,originHeader=origin,contentType='application/json'}={})=>
 new Request(origin+path,{method,headers:{Origin:originHeader,...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-Rumbo-CSRF':csrf}:{}),...(method==='POST'?{'Content-Type':contentType}:{})},...(method==='POST'?{body:JSON.stringify(path==='/session/login'?{password}:{})}:{})});
test('sesión: la contraseña no aparece en cookie y el token no está en respuesta',async()=>{
 const {api,entries}=create();const res=await api(req('/session/login','POST'));
 assert.equal(res.status,200);const cookie=res.headers.get('Set-Cookie');
 assert.match(cookie,/HttpOnly; Secure; SameSite=Strict; Path=\//);
 assert.doesNotMatch(cookie,new RegExp(secret));
 assert.equal(entries.size,1);
 const body=await res.json();assert.ok(body.csrf);assert.ok(!JSON.stringify(body).includes(secret));
 assert.equal((await api(req('/session','GET',{cookie:cookie.split(';')[0]}))).status,200);
});
test('rechaza origen ajeno, contraseña errónea y solicitud sin HTTPS',async()=>{
 const {api,entries}=create();
 assert.equal((await api(req('/session/login','POST',{originHeader:'https://evil.test'}))).status,403);
 assert.equal((await api(req('/session/login','POST',{password:'mal'}))).status,401);
 assert.equal(entries.size,0);
 const insecure=req('/session');assert.equal((await api(new Request('http://rumbo.example.test/session',{headers:{Origin:origin}}))).status,403);
});
test('logout exige CSRF y revoca la sesión inmediatamente',async()=>{
 const {api,entries}=create();
 const login=await api(req('/session/login','POST'));const cookie=login.headers.get('Set-Cookie').split(';')[0],{csrf}=await login.json();
 assert.equal((await api(req('/session/logout','POST',{cookie,csrf:'invalid'}))).status,403);
 assert.equal((await api(req('/session','GET',{cookie}))).status,200);
 const logout=await api(req('/session/logout','POST',{cookie,csrf}));
 assert.equal(logout.status,200);assert.match(logout.headers.get('Set-Cookie'),/Max-Age=0/);
 assert.equal(entries.size,0);
 assert.equal((await api(req('/session','GET',{cookie}))).status,401);
});
test('caducidad absoluta y no renovación silenciosa',async()=>{
 const {api,setTime}=create();const login=await api(req('/session/login','POST')),cookie=login.headers.get('Set-Cookie').split(';')[0];
 setTime(Date.UTC(2026,11,16));
 assert.equal((await api(req('/session','GET',{cookie}))).status,401);
});
test('login repetido rota el identificador e invalida el anterior',async()=>{
 const {api,entries}=create();
 const one=await api(req('/session/login','POST'));const first=one.headers.get('Set-Cookie').split(';')[0];
 const two=await api(req('/session/login','POST',{cookie:first}));const second=two.headers.get('Set-Cookie').split(';')[0];
 assert.notEqual(first,second);assert.equal(entries.size,1);
 assert.equal((await api(req('/session','GET',{cookie:first}))).status,401);
 assert.equal((await api(req('/session','GET',{cookie:second}))).status,200);
});
test('falla cerrado si falta almacén consistente o secreto',()=>{
 assert.throws(()=>createSessionApi({store:{},secret,apiOrigin:origin}));
 assert.throws(()=>createSessionApi({store:{get(){},put(){},delete(){}},secret:'short',apiOrigin:origin}));
});
