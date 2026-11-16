// Real-network smoke test on a disposable Worker and dedicated KV namespace.
// NEVER uses production KV, production Worker or production password.
import {writeFile,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomBytes,randomUUID,webcrypto} from 'node:crypto';
const account='2bc103e4dec32961305599da77b877f6';
const scriptName='rumbo-entrenamiento-pr36-test';
const origin='https://oposicvigo.vercel.app';
const token=process.env.CLOUDFLARE_API_TOKEN;
const run=String(process.env.GITHUB_RUN_ID||'manual').replace(/[^0-9]/g,'');
if(!token||!run)throw Error('Requiere CLOUDFLARE_API_TOKEN y GITHUB_RUN_ID para una prueba aislada.');
const kvTitle='rumbo-training-test-'+run;
const namespaceUrl=`https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces`;
const workerUrl=`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${scriptName}`;
let namespaceId=null,workerCreated=false;
const out={};
const config='rumbo-worker/release-training-test.generated.json';
async function cloudflare(url,method='GET',value){
 const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token,...(value?{'Content-Type':'application/json'}:{})},body:value?JSON.stringify(value):undefined,signal:AbortSignal.timeout(30000)});
 const data=await r.json().catch(()=>null);
 if(!r.ok||!data?.success)throw Error('Cloudflare '+method+' HTTP '+r.status+' codes '+(data?.errors||[]).map(x=>x.code).join(','));
 return data.result;
}
function wrangler(args,input){
 const result=spawnSync('./node_modules/.bin/wrangler',args,{cwd:'rumbo-worker',input,encoding:'utf8',timeout:90000,env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account,WRANGLER_SEND_METRICS:'false'}});
 if(result.status!==0)throw Error('Staging Wrangler error '+(result.stdout+' '+result.stderr).match(/\[code: \d+\]/g)?.join(','));
}
const password=randomBytes(48).toString('hex');
const auth='Rumbo '+Buffer.from(password,'utf8').toString('base64');
const endpoint=`https://${scriptName}.jose-arial.workers.dev`;
async function req(method,path,data,from=origin,authorized=true){
 return fetch(endpoint+path,{method,headers:{Origin:from,...(authorized?{Authorization:auth}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
}
const enc=new TextEncoder(),dec=new TextDecoder(),to64=v=>Buffer.from(v).toString('base64'),from64=v=>Buffer.from(v,'base64');
async function derive(salt){
 const key=await webcrypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 return webcrypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:180000,hash:'SHA-256'},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function smoke(){
 const pre=await req('OPTIONS','/training',null,origin,false);
 if(pre.status!==204)throw Error('CORS preflight: '+pre.status);
 const unauth=await req('GET','/training',null,origin,false);
 if(unauth.status!==401)throw Error('Authentication not denied: '+unauth.status);
 const forbidden=await req('GET','/training',null,'https://origen-no-permitido.invalid',true);
 if(forbidden.status!==403)throw Error('Origin not denied: '+forbidden.status);
 const fields={situacion:'situacion ficticia',pensamiento:'pensamiento ficticio',emocion:'emocion ficticia',conducta:'conducta ficticia'};
 const salt=randomBytes(16),iv=randomBytes(12),key=await derive(salt);
 const cipher=await webcrypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(fields)));
 const record={version:1,id:randomUUID(),date:new Date().toISOString(),salt:to64(salt),iv:to64(iv),cipher:to64(cipher)};
 const write=await req('POST','/training',record);
 if(write.status!==201)throw Error('Write: '+write.status);
 let found=null;
 for(let attempt=0;attempt<12;attempt++){
  const r=await req('GET','/training');
  if(r.status!==200)throw Error('Read: '+r.status);
  found=(await r.json()).records.find(x=>x.id===record.id);
  if(found)break;
  await new Promise(done=>setTimeout(done,1000));
 }
 if(!found)throw Error('Record missing from real KV');
 const clear=dec.decode(await webcrypto.subtle.decrypt({name:'AES-GCM',iv:from64(found.iv)},await derive(from64(found.salt)),from64(found.cipher)));
 if(JSON.stringify(JSON.parse(clear))!==JSON.stringify(fields))throw Error('Decrypt mismatch');
 const retry=await req('POST','/training',record);
 if(retry.status!==200)throw Error('Idempotence failed: '+retry.status);
 const deletion=await req('DELETE','/training/'+record.id);
 if(deletion.status!==200)throw Error('Delete failed: '+deletion.status);
 for(let attempt=0;attempt<12;attempt++){
  const r=await req('GET','/training');const rows=(await r.json()).records;
  if(!rows.some(x=>x.id===record.id)){console.log('PASS isolated real KV: CORS, auth, AES-GCM, create, read, repeat, delete. No real user data.');return;}
  await new Promise(done=>setTimeout(done,1000));
 }
 throw Error('KV deletion was not confirmed.');
}
try{
 // Fail closed if an old staging Worker already exists; never overwrite even staging.
 const check=await fetch(workerUrl,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
 if(check.status!==404)throw Error('Staging Worker name already exists or cannot verify absence; aborting (HTTP '+check.status+').');
 const namespace=await cloudflare(namespaceUrl,'POST',{title:kvTitle});
 namespaceId=namespace.id;
 await writeFile(config,JSON.stringify({name:scriptName,main:'worker.mjs',compatibility_date:'2026-01-01',workers_dev:true,kv_namespaces:[{binding:'NOTES_KV',id:namespaceId}],vars:{ALLOWED_ORIGIN:origin,FREE_TIER_CONFIRMED:'false'},observability:{enabled:false}}),{mode:0o600});
 // No D1 binding; separate KV; never any production secrets.
 workerCreated=true;
 wrangler(['deploy','--config','release-training-test.generated.json']);
 // Install the temporary password using the Cloudflare API, not Wrangler's default config.
 // The default wrangler.toml belongs to production and must never be used for secrets.
 await cloudflare(workerUrl+'/secrets','PUT',{type:'secret_text',name:'RUMBO_ACCESS_TOKEN',text:password});
 const settings=await cloudflare(workerUrl+'/settings');
 if(!settings.bindings?.some(b=>b.name==='RUMBO_ACCESS_TOKEN'&&b.type==='secret_text'))throw Error('Staging secret binding not confirmed');
 if(!settings.bindings?.some(b=>b.name==='NOTES_KV'&&b.type==='kv_namespace'&&b.namespace_id===namespaceId))throw Error('Staging KV binding not confirmed');
 // A newly deployed Worker version may take a few moments to become active globally.
 let ready=false;
 for(let i=0;i<20;i++){
  const r=await req('GET','/training',null,origin,false);
  if(r.status===401){ready=true;break;}
  if(r.status!==503)throw Error('Unexpected authentication readiness status: '+r.status);
  await new Promise(resolve=>setTimeout(resolve,1500));
 }
 if(!ready)throw Error('Staging authentication was not ready after controlled retries.');
 await smoke();
}catch(e){console.error('Staging test failed: '+e.message);process.exitCode=1;
}finally{
 try{await unlink(config);}catch{}
 if(workerCreated){
  try{await cloudflare(workerUrl,'DELETE');console.log('Disposable Worker deleted.');}
  catch(e){console.error('IMPORTANT: staging Worker cleanup failed. '+e.message);process.exitCode=1;}
 }
 if(namespaceId){
  try{await cloudflare(namespaceUrl+'/'+namespaceId,'DELETE');console.log('Disposable KV namespace deleted.');}
  catch(e){console.error('IMPORTANT: staging namespace cleanup failed. '+e.message);process.exitCode=1;}
 }
}
