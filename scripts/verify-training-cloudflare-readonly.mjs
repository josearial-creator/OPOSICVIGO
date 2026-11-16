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
 if(staging.status===404)console.log('PASS: staging Worker has been removed after the cleanup.');
 else{
  assert(staging.status===200&&staging.success,'cannot inspect staging Worker HTTP '+staging.status);
  assert(Array.isArray(staging.result?.bindings),'staging bindings could not be verified');
  assert(staging.result.bindings.length===0,'staging Worker has remaining bindings: no test allowed');
  console.log('PASS: staging Worker exists but is isolated, with no bindings.');
 }
 const stageNew=await get('/workers/scripts/snowy-river-c4rumbo-entrenamiento-pr36-test2a6/settings');
 assert(stageNew.status===200&&stageNew.success,'new PR36 Worker not found: HTTP '+stageNew.status+' codes '+stageNew.codes.join(','));
 assert(Array.isArray(stageNew.result?.bindings),'new staging bindings could not be verified');
 assert(stageNew.result.bindings.length===0,'new staging Worker already has bindings: test blocked');
 console.log('PASS: newly created Worker has the exact authorized name and zero bindings.');
 const namespaces=await get('/storage/kv/namespaces?per_page=100');
 assert(namespaces.status===200&&namespaces.success,'KV namespace list cannot be inspected');
 assert(!(namespaces.result||[]).some(x=>x.title==='rumbo-training-test-43902343610'),'temporary KV from run 7 remains');
 console.log('PASS: no KV from failed run 7 remains.');
 const production=await get('/workers/scripts/rumbo-entrenador/settings');
 assert(production.status===200&&production.success,'production settings not readable: HTTP '+production.status+' codes '+production.codes.join(','));
 // Check binding TYPES ONLY, never read or print secret values, IDs or note content.
 assert(production.result?.bindings?.some(b=>b.name==='RUMBO_ACCESS_TOKEN'&&b.type==='secret_text'),'production authentication binding missing');
 assert(production.result?.bindings?.some(b=>b.name==='NOTES_KV'&&b.type==='kv_namespace'),'production NOTES_KV binding missing');
 console.log('PASS: production existing bindings are readable, no values disclosed and no changes made.');
 console.log('PASS: Cloudflare read-only integrity checked; a real synchronization test is still pending.');
}catch(e){console.error(e.message);process.exitCode=1;}
