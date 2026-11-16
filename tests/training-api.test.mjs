import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingApi} from '../rumbo-worker/training-api.mjs';

const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const record={version:1,id,date:'2026-11-16T13:00:00.000Z',salt:Buffer.alloc(16,1).toString('base64'),iv:Buffer.alloc(12,2).toString('base64'),cipher:Buffer.alloc(32,3).toString('base64')};
function memoryKv(){
 const data=new Map();
 return {data,async list({prefix}){return {keys:[...data.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true};},async get(key,format){const v=data.get(key);return format==='json'&&v?JSON.parse(v):v??null;},async put(k,v){data.set(k,v);},async delete(k){data.delete(k);}};
}
function req(method,path,body){return new Request('https://example.com'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});}
test('registro cifrado: guardar, listar, reintentar y borrar sin tocar notas',async()=>{
 const kv=memoryKv();const env={NOTES_KV:kv};
 kv.data.set('private-notes/v1/owner/'+id,JSON.stringify({text:'DIARIO INTACTO'}));
 let res=await trainingApi(req('POST','/training',record),env,'/training');assert.equal(res.status,201);
 res=await trainingApi(req('POST','/training',record),env,'/training');assert.equal(res.status,200);
 res=await trainingApi(req('GET','/training'),env,'/training');const data=await res.json();
 assert.equal(data.records.length,1);assert.deepEqual(data.records[0],record);
 assert.equal(JSON.stringify(data).includes('DIARIO INTACTO'),false);
 res=await trainingApi(req('DELETE','/training/'+id),env,'/training/'+id);assert.equal(res.status,200);
 assert.equal(kv.data.has('private-notes/v1/owner/'+id),true);
 assert.equal(kv.data.has('private-training/v1/owner/'+id),false);
});
test('nunca recibe texto personal sin cifrar y no ofrece borrado masivo',async()=>{
 const kv=memoryKv(),env={NOTES_KV:kv};
 let res=await trainingApi(req('POST','/training',{...record,situacion:'privado'}),env,'/training');assert.equal(res.status,400);
 assert.equal(kv.data.has('private-training/v1/owner/'+id),false);
 res=await trainingApi(req('POST','/training',record),env,'/training');assert.equal(res.status,201);
 assert.equal(kv.data.get('private-training/v1/owner/'+id).includes('situacion'),false);
 res=await trainingApi(req('POST','/training',{...record,id:'invalid'}),env,'/training');assert.equal(res.status,400);
 res=await trainingApi(req('DELETE','/training'),env,'/training');assert.equal(res.status,405);
 res=await trainingApi(req('GET','/training/invalid'),env,'/training/invalid');assert.equal(res.status,404);
 res=await trainingApi(req('POST','/training',{...record,iv:'bad'}),env,'/training');assert.equal(res.status,400);
});
