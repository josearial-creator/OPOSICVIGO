// Limpieza excepcional tras ejecución aislada PR36 #7 (2026-11-16).
// Objetivos FIJOS: un Worker descartable y un namespace KV por título exacto.
// No crea recursos, no accede al diario ni altera el Worker rumbo-entrenador.
const account='2bc103e4dec32961305599da77b877f6';
const targetWorker='fancy-sea-977drumbo-entrenamiento-pr36-test';
const targetKvTitle='rumbo-training-test-43902343610';
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token)throw Error('No hay credencial para la limpieza aislada.');
const base='https://api.cloudflare.com/client/v4/accounts/'+account;
async function call(path,method='GET'){
 const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(25000)});
 const result=await response.json().catch(()=>({}));
 if(response.status!==404&&(!response.ok||result.success!==true))
  throw Error('Cloudflare '+method+' HTTP '+response.status+', codes='+(result.errors||[]).map(e=>e.code).join(','));
 return {status:response.status,body:result.result};
}
async function namespaces(){
 const found=[];let totalPages=1;
 for(let page=1;page<=Math.min(totalPages,10);page++){
  const response=await fetch(base+'/storage/kv/namespaces?per_page=100&page='+page,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(25000)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.success!==true)throw Error('No se pudo consultar KV: HTTP '+response.status);
  totalPages=Number(result.result_info?.total_pages||1);
  for(const item of result.result||[])if(item.title===targetKvTitle)found.push(item);
 }
 if(found.length>1)throw Error('Hay varios KV con el título esperado; operación bloqueada.');
 return found[0]||null;
}
async function verifyWorkerAbsent(){
 for(let i=0;i<12;i++){
  const result=await call('/workers/scripts/'+encodeURIComponent(targetWorker)+'/settings');
  if(result.status===404)return true;
  if(i<11)await new Promise(ok=>setTimeout(ok,1500));
 }
 return false;
}
const kv=await namespaces();
const worker=await call('/workers/scripts/'+encodeURIComponent(targetWorker)+'/settings');
if(worker.status===200){
 const bindings=worker.body?.bindings;
 if(!Array.isArray(bindings))throw Error('Sin lista verificable de bindings: no se borra.');
 const allowed=new Set(['NOTES_KV','RUMBO_ACCESS_TOKEN','ALLOWED_ORIGIN','FREE_TIER_CONFIRMED']);
 if(bindings.some(b=>!allowed.has(b.name)))throw Error('Worker de prueba con bindings no previstos: no se borra.');
 const boundKv=bindings.find(b=>b.name==='NOTES_KV');
 if(boundKv&&(!kv||boundKv.type!=='kv_namespace'||boundKv.namespace_id!==kv.id))
  throw Error('El KV del Worker no coincide con la copia temporal esperada.');
 console.log('PASS: nombre, cuenta y bindings del Worker temporal verificados.');
 const result=await call('/workers/scripts/'+encodeURIComponent(targetWorker),'DELETE');
 if(![200,202,204,404].includes(result.status))throw Error('No se confirmó la solicitud de eliminación del Worker temporal.');
 if(!await verifyWorkerAbsent())throw Error('El Worker temporal sigue en Cloudflare; el KV se conserva por seguridad.');
 console.log('PASS: Worker temporal eliminado y ausencia confirmada mediante API.');
}else if(worker.status===404){
 console.log('PASS: Worker temporal ya no existe.');
}else throw Error('No se pudo verificar el Worker: HTTP '+worker.status);
if(kv){
 await call('/storage/kv/namespaces/'+encodeURIComponent(kv.id),'DELETE');
 const left=await namespaces();
 if(left)throw Error('El KV de prueba sigue figurando después de la eliminación.');
 console.log('PASS: KV temporal de la ejecución #7 eliminado y ausencia confirmada.');
}else console.log('PASS: no queda KV temporal de la ejecución #7.');
console.log('Limpieza aislada concluida; Worker principal y 132 registros no consultados.');
