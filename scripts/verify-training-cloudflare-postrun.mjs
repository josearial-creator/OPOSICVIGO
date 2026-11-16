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
 if(response.status!==200||!json.success)return {done:false,summary:'Cloudflare settings HTTP '+response.status};
 const bindings=json.result?.bindings||[];
 const clean=bindings.length===0;
 let code=-1;
 try{const response=await fetch(url,{headers:{Origin:'https://oposicvigo.vercel.app'},cache:'no-store',signal:AbortSignal.timeout(15000)});code=response.status;}catch{}
 return {done:clean&&code===410,summary:'Bindings='+(clean?'none':'present')+'; Worker HTTP='+code};
}
let result;
for(let attempt=0;attempt<24;attempt++){
 result=await inspect();
 if(result.done)break;
 if(attempt<23)await new Promise(resolve=>setTimeout(resolve,5000));
}
if(result?.done){console.log('PASS: Worker temporal desactivado (HTTP 410), sin secretos, KV ni otros bindings.');}
else{console.error('BLOCKED: no se ha confirmado la limpieza del Worker de pruebas. '+(result?.summary||'No response')+'. No repetir el ensayo.');process.exitCode=1;}
