import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../rumbo-worker/worker.mjs';

const token='test-access-token-32-characters-xxxxxxxxxxx';
const env={ALLOWED_ORIGIN:'https://example.test',RUMBO_ACCESS_TOKEN:token,FREE_TIER_CONFIRMED:'true',GEMINI_API_KEY:'fake-key'};
const data={mimeType:'audio/webm',audioBase64:Buffer.alloc(300,17).toString('base64')};
const req=(value=data,{origin='https://example.test',password=token,method='POST'}={})=>new Request('https://worker.example/transcribe',{
 method,headers:{Origin:origin,Authorization:'Bearer '+password,'Content-Type':'application/json'},
 ...(method==='POST'?{body:JSON.stringify(value)}:{})
});
test('Transcribe cerrado por defecto, sin llamar a Gemini',async()=>{
 const old=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;throw Error('No debe invocarse')};
  assert.equal((await worker.fetch(req(),{...env,FREE_TIER_CONFIRMED:'false'})).status,503);
  assert.equal((await worker.fetch(req(),{...env,GEMINI_API_KEY:''})).status,503);
  assert.equal((await worker.fetch(req(),{...env,RUMBO_ACCESS_TOKEN:''})).status,503);
  assert.equal((await worker.fetch(req(),env)).status===200,false);
  assert.equal(calls,1); // Solo esta última petición, con controles completos.
 }finally{globalThis.fetch=old;}
});
test('Autorización y origen impiden acceso al audio',async()=>{
 assert.equal((await worker.fetch(req(data,{origin:'https://untrusted.example'}),env)).status,403);
 assert.equal((await worker.fetch(req(data,{password:'mal'}),env)).status,401);
 assert.equal((await worker.fetch(req(data,{method:'GET'}),env)).status,404);
});
test('Audio inválido rechazado antes de la llamada a Gemini',async()=>{
 const old=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;throw Error('No invocar')};
  for(const bad of [
   {...data,mimeType:'text/html'},
   {...data,audioBase64:'a'.repeat(470005)},
   {...data,audioBase64:'%%%'},
   {...data,audioBase64:''},
  ])assert.equal([400,413].includes((await worker.fetch(req(bad),env)).status),true);
  assert.equal(calls,0);
 }finally{globalThis.fetch=old;}
});
test('Transcripción única, no devuelve ni almacena audio',async()=>{
 const old=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async(url,options)=>{
   calls++;assert.equal(new URL(url).hostname,'generativelanguage.googleapis.com');
   assert.equal(options.headers['x-goog-api-key'],'fake-key');
   const body=JSON.parse(options.body);
   assert.equal(body.contents[0].parts[1].inlineData.mimeType,'audio/webm');
   return Response.json({candidates:[{content:{parts:[{text:'Abrir el temario y repasar.'}]}}]});
  };
  const res=await worker.fetch(req(),env);
  assert.equal(res.status,200);
  assert.equal(res.headers.get('Cache-Control'),'no-store');
  assert.equal(res.headers.get('Access-Control-Allow-Origin'),'https://example.test');
  const body=await res.json();
  assert.equal(body.text,'Abrir el temario y repasar.');
  assert.equal(JSON.stringify(body).includes(data.audioBase64),false);
  assert.equal(calls,1);
 }finally{globalThis.fetch=old;}
});
test('La cuota gratuita no permite reintentos automáticos',async()=>{
 const old=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return new Response('',{status:429})};
  const res=await worker.fetch(req(),env);
  assert.equal(res.status,429);assert.equal(calls,1);
 }finally{globalThis.fetch=old;}
});
