// Preflight de SOLO LECTURA para la prueba aislada de Entrenamiento.
// No despliega, no crea recursos, no modifica variables, no muestra secretos.
const account='2bc103e4dec32961305599da77b877f6';
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token){console.error('BLOCKED: falta credencial GitHub para diagnóstico de solo lectura.');process.exit(1);}
const base='https://api.cloudflare.com/client/v4/accounts/'+account;
async function get(path){
 let response;
 try{response=await fetch(base+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});}
 catch{throw Error('Network error in read-only preflight');}
 const obj=await response.json().catch(()=>({}));
 return {status:response.status,success:obj.success===true,result:obj.result,codes:(obj.errors||[]).map(x=>x.code)};
}
function assert(ok,label){if(!ok)throw Error('BLOCKED '+label);}
try{
 const domain=await get('/workers/subdomain');
 assert(domain.status===200&&domain.success,'workers.dev subdomain endpoint: HTTP '+domain.status+' codes '+domain.codes.join(','));
 const actual=domain.result?.subdomain;
 assert(typeof actual==='string'&&actual.length>0,'workers.dev subdomain missing');
 console.log('PASS: account workers.dev subdomain exists (value hidden).');
 // Do not trust a guessed workers.dev address. Warn if the configured hostname is wrong.
 assert(actual==='jose-arial','configured staging hostname mismatch (no changes made)');
 console.log('PASS: configured staging workers.dev hostname matches account.');
 const staging=await get('/workers/scripts/fancy-sea-977drumbo-entrenamiento-pr36-test/settings');
 if(staging.status===404){
  const list=await get('/workers/scripts');
  if(list.status===200&&list.success&&Array.isArray(list.result)){
   const candidates=list.result.map(x=>String(x.id||x.name||'')).filter(x=>/entrenam|pr36|fancy-sea/i.test(x));
   if(candidates.length)console.log('WORKER_NAME_MISMATCH: posibles nombres de prueba: '+candidates.join(', '));
   else console.log('WORKER_NAME_MISMATCH: ninguno de los Workers listados coincide con entrenamiento.');
  }else console.log('WORKER_NAME_MISMATCH: no se pudo consultar el listado de Workers.');
 }
 assert(staging.status===200&&staging.success,'staging Worker not found: HTTP '+staging.status+' codes '+staging.codes.join(','));
 assert(Array.isArray(staging.result?.bindings),'staging Worker bindings could not be verified');
 assert(staging.result.bindings.length===0,'staging Worker has existing bindings; refusing to overwrite');
 console.log('PASS: staging Worker exists and has no bindings.');
 const production=await get('/workers/scripts/rumbo-entrenador/settings');
 assert(production.status===200&&production.success,'production settings not readable: HTTP '+production.status+' codes '+production.codes.join(','));
 // Check binding TYPES ONLY, never read or print secret values, IDs or note content.
 assert(production.result?.bindings?.some(b=>b.name==='RUMBO_ACCESS_TOKEN'&&b.type==='secret_text'),'production authentication binding missing');
 assert(production.result?.bindings?.some(b=>b.name==='NOTES_KV'&&b.type==='kv_namespace'),'production NOTES_KV binding missing');
 console.log('PASS: production existing bindings are readable, no values disclosed and no changes made.');
 console.log('PASS: read-only Cloudflare prerequisites checked. Deployment permissions and actual KV writes remain untested.');
}catch(e){console.error(e.message);process.exitCode=1;}
