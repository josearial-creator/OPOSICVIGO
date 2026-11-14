// Release explicitly authorized on 2026-11-14. No personal notes are listed or migrated.
import {writeFile,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export function configuration(settings,namespace){
 const bindings=settings.bindings||[];
 if(bindings.some(b=>!['plain_text','json','secret_text','kv_namespace','d1'].includes(b.type)))throw Error('Binding no reconocido: despliegue bloqueado para conservarlo.');
 if(!bindings.some(b=>b.type==='secret_text'&&b.name==='RUMBO_ACCESS_TOKEN'))throw Error('Falta el secreto del diario en el Worker.');
 const db=bindings.find(b=>b.name==='db'&&b.type==='d1');
 if(db?.id!=='7752c042-d26f-4a4b-8b81-5bdbf17ff0fd')throw Error('D1 no coincide con la base existente.');
 if(bindings.some(b=>b.name==='NOTES_KV'&&b.type!=='kv_namespace'))throw Error('NOTES_KV tiene otro tipo.');
 const existing=bindings.find(b=>b.name==='NOTES_KV');
 if(existing&&existing.namespace_id!==namespace)throw Error('No se puede sustituir NOTES_KV existente.');
 const origins=new Set((bindings.find(b=>b.name==='ALLOWED_ORIGIN')?.text||'').split(',').map(s=>s.trim()).filter(Boolean));
 for(const o of ['https://josearial-creator.github.io','https://oposicvigo.vercel.app','https://josearial-creatorgithubio.vercel.app'])origins.add(o);
 if([...origins].some(o=>{try{return new URL(o).origin!==o||!o.startsWith('https://');}catch{return true;}}))throw Error('Origen actual no válido: revisar antes de modificar.');
 const kv=bindings.filter(b=>b.type==='kv_namespace').map(b=>({binding:b.name,id:b.namespace_id}));
 if(!existing)kv.push({binding:'NOTES_KV',id:namespace});
 return {name:'rumbo-entrenador',main:'worker.mjs',compatibility_date:settings.compatibility_date||'2026-01-01',compatibility_flags:settings.compatibility_flags||[],workers_dev:true,keep_vars:true,kv_namespaces:kv,d1_databases:bindings.filter(b=>b.type==='d1').map(b=>({binding:b.name,database_id:b.id})),vars:{ALLOWED_ORIGIN:[...origins].join(',')},observability:settings.observability||{enabled:false}};
}
async function main(){
 const {CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token,RUMBO_ACCESS_TOKEN:password}=process.env;
 if(account!=='2bc103e4dec32961305599da77b877f6'||!token||!password||password.length<32)throw Error('Faltan credenciales existentes válidas.');
 const base=`https://api.cloudflare.com/client/v4/accounts/${account}`;
 async function cf(path,method='GET',body){
  const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  const data=await response.json();if(!response.ok||!data.success)throw Error(`Cloudflare ${method}: HTTP ${response.status}; códigos ${(data.errors||[]).map(e=>e.code).join(',')}`);
  return data.result;
 }
 const settings=await cf('/workers/scripts/rumbo-entrenador/settings');
 // Validate all pre-existing bindings before creating any resource.
 const bound=settings.bindings?.find(b=>b.name==='NOTES_KV');
 configuration(settings,bound?.namespace_id||'preflight');
 let namespace=bound?.namespace_id;
 if(!namespace){
  const namespaces=[];for(let page=1;;page++){const batch=await cf(`/storage/kv/namespaces?per_page=100&page=${page}`);namespaces.push(...batch);if(batch.length<100)break;}
  const matches=namespaces.filter(n=>n.title==='rumbo-private-notes-v1');
  if(matches.length>1)throw Error('Hay varios almacenes con el mismo nombre.');
  namespace=matches[0]?.id;
  if(!namespace)namespace=(await cf('/storage/kv/namespaces','POST',{title:'rumbo-private-notes-v1'})).id;
 }
 const config=configuration(settings,namespace);
 const configPath='rumbo-worker/release-notes.generated.json';
 await writeFile(configPath,JSON.stringify(config),{mode:0o600});
 try{
  const result=spawnSync('./node_modules/.bin/wrangler',['deploy','--config','release-notes.generated.json','--keep-vars'],{cwd:'rumbo-worker',env:{...process.env,WRANGLER_SEND_METRICS:'false'},encoding:'utf8',timeout:120000});
  // Wrangler may echo variables; do not forward its raw output.
  if(result.status!==0){const codes=(result.stdout+' '+result.stderr).match(/\[code: \d+\]/g)||[];throw Error('Wrangler no completó el despliegue. '+codes.join(' '));}
 }finally{await unlink(configPath);}
 const after=await cf('/workers/scripts/rumbo-entrenador/settings');
 for(const b of settings.bindings||[]){const saved=after.bindings.find(x=>x.name===b.name);if(!saved||saved.type!==b.type||(b.id&&saved.id!==b.id)||(b.namespace_id&&saved.namespace_id!==b.namespace_id))throw Error('Verificación de conservación de bindings falló.');}
 if(!after.bindings.some(b=>b.name==='NOTES_KV'&&b.namespace_id===namespace))throw Error('Binding NOTES_KV no confirmado.');
 console.log('Worker actualizado; D1, almacenes existentes y secretos conservados.');
 const endpoint='https://rumbo-entrenador.jose-arial.workers.dev';
 const origins=['https://oposicvigo.vercel.app','https://josearial-creatorgithubio.vercel.app'];
 const auth='Rumbo '+Buffer.from(password,'utf8').toString('base64');
 const createId=crypto.randomUUID(),text='Prueba automática de activación de Rumbo. Sin datos personales.';
 async function request(origin,method,path,body,authorized=true){return fetch(endpoint+path,{method,headers:{Origin:origin,...(authorized?{Authorization:auth}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});}
 for(const origin of origins){
  const pre=await request(origin,'OPTIONS','/notes',null,false);if(pre.status!==204||pre.headers.get('Access-Control-Allow-Origin')!==origin)throw Error('Preflight del diario no válido.');
  const denied=await request(origin,'POST','/notes',{text},false);if(denied.status!==401)throw Error('El diario no rechazó el acceso sin contraseña.');
 }
 const foreign=await request('https://origen-no-autorizado.invalid','POST','/notes',{text},false);if(foreign.status!==403)throw Error('Origen ajeno no rechazado.');
 // Only this fresh synthetic UUID is read and cleaned up. Never list user notes.
 try{
  const saved=await request(origins[0],'POST','/notes',{createId,text});if(saved.status!==201)throw Error('Guardado autenticado no confirmado: HTTP '+saved.status);
  for(const origin of origins){
   let found=false;
   for(let i=0;i<25;i++){
    const res=await request(origin,'GET','/notes/'+createId);if(res.status===200&&(await res.json()).note?.text===text){found=true;break;}
    await new Promise(r=>setTimeout(r,5000));
   }
   if(!found)throw Error('Lectura del registro sintético no confirmada.');
  }
  const repeat=await request(origins[0],'POST','/notes',{createId,text});if(repeat.status!==200)throw Error('Reintento del diario no confirmado.');
  console.log('PASS diario real: autenticación, CORS, guardado, lectura desde ambos orígenes y reintento sin duplicación.');
 }finally{
  // Remove only the unique disposable test note through the authenticated provider API.
  await cf('/storage/kv/namespaces/'+namespace+'/values/'+encodeURIComponent('private-notes/v1/owner/'+createId),'DELETE');
  console.log('Registro sintético eliminado; no se han consultado anotaciones personales.');
 }
}
if(import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error('::error::'+e.message);process.exitCode=1;});
