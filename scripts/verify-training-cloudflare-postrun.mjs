// Verificación de SOLO LECTURA tras el ensayo real de PR #36.
// Nunca modifica Workers ni consulta datos del usuario.
const account='2bc103e4dec32961305599da77b877f6';
const staging='fancy-sea-977drumbo-entrenamiento-pr36-test';
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token)throw Error('BLOCKED: token de diagnóstico ausente');
const settingsUrl=`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${staging}/settings`;
const url=`https://${staging}.jose-arial.workers.dev/training`;
async function inspect(){
 const response=await fetch(settingsUrl,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
 const json=await response.json().catch(()=>({}));
 let workerClean=false,summary='';
 if(response.status===404){
  workerClean=true;
  summary='Worker ausente';
 }else if(response.status===200&&json.success){
  const bindings=json.result?.bindings||[];
  const clean=bindings.length===0;
  let code=-1;
  try{const reply=await fetch(url,{headers:{Origin:'https://oposicvigo.vercel.app'},cache:'no-store',signal:AbortSignal.timeout(15000)});code=reply.status;}catch{}
  workerClean=clean&&code===410;
  summary='Bindings='+(clean?'none':'present')+'; Worker HTTP='+code;
 }else return {done:false,summary:'Cloudflare settings HTTP '+response.status};
 const ns=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces?per_page=100`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
 const result=await ns.json().catch(()=>({}));
 const complete=ns.status===200&&result.success===true&&Number(result.result_info?.total_pages||1)===1;
 if(!complete)return {done:false,summary:summary+'; listado KV sin confirmar'};
 const absent=!(result.result||[]).some(x=>x.title==='rumbo-training-test-43902343610');
 return {done:workerClean&&absent,summary:summary+'; KV #7 '+(absent?'ausente':'presente')};
}
let result;
for(let attempt=0;attempt<24;attempt++){
 result=await inspect();
 if(result.done)break;
 if(attempt<23)await new Promise(resolve=>setTimeout(resolve,5000));
}
if(result?.done){console.log('PASS: Worker temporal desactivado o eliminado; KV residual de #7 ausente.');}
else{console.error('BLOCKED: no se ha confirmado la limpieza del Worker de pruebas. '+(result?.summary||'No response')+'. No repetir el ensayo.');process.exitCode=1;}
