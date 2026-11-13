// Read-only checks; no notes, secrets, identifiers or raw API bodies are logged.
const {CLOUDFLARE_API_TOKEN:cf,CLOUDFLARE_ACCOUNT_ID:account,RUMBO_ACCESS_TOKEN:access}=process.env;
const summary={adminCredentialPresent:!!cf,accessSecretPresent:!!access,accessSecretLengthValid:!!access&&access.length>=32};
async function inspect(){
 if(!cf||!account){summary.configuration='unavailable';return;}
 try{
  const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/rumbo-entrenador/settings`,{headers:{Authorization:'Bearer '+cf},signal:AbortSignal.timeout(20000)});
  summary.adminStatus=r.status;if(!r.ok)return;
  const data=await r.json();if(!data.success){summary.configuration='unavailable';return;}
  const bs=data.result?.bindings||[];
  summary.notesKV=bs.some(b=>b.name==='NOTES_KV'&&b.type==='kv_namespace');
  summary.d1Preserved=bs.some(b=>b.name==='db'&&b.type==='d1');
  summary.workerAccessSecret=bs.some(b=>b.name==='RUMBO_ACCESS_TOKEN'&&b.type==='secret_text');
  const allowed=(bs.find(b=>b.name==='ALLOWED_ORIGIN')?.text||'').split(',').map(s=>s.trim());
  summary.originOposicvigo=allowed.includes('https://oposicvigo.vercel.app');
  summary.originPrincipal=allowed.includes('https://josearial-creatorgithubio.vercel.app');
 }catch{summary.configuration='request_failed';}
}
await inspect();
console.log('Diagnóstico de configuración (solo lectura): '+JSON.stringify(summary));
console.log('No se ha fusionado, desplegado, cambiado secretos ni accedido a registros personales.');
