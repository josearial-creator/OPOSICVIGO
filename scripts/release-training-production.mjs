// Publicación MANUAL del backend PR36. Nunca se ejecuta al importar este módulo.
// Conserva KV del diario, D1, secretos y orígenes. No lee anotaciones personales.
import {writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {configuration} from './activate-notes-20261114.mjs';
const account='2bc103e4dec32961305599da77b877f6';
const worker='rumbo-entrenador';
const expectedDb='7752c042-d26f-4a4b-8b81-5bdbf17ff0fd';
const authorizedBranch=new Set(['refs/heads/main']);
const requiredOrigins=['https://oposicvigo.vercel.app','https://josearial-creator.github.io','https://josearial-creatorgithubio.vercel.app'];
const token=process.env.CLOUDFLARE_API_TOKEN;
if(process.env.PR36_RELEASE_CONFIRM!=='PUBLICAR-ENTRENAMIENTO-PR36')throw Error('Publicación bloqueada: falta aprobación explícita.');
if(!authorizedBranch.has(process.env.GITHUB_REF))throw Error('Publicación bloqueada: rama no autorizada.');
if(!token||/\s/.test(token))throw Error('Publicación bloqueada: token de Cloudflare ausente o inválido.');
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+worker;
const path='rumbo-worker/.pr36-release-production.generated.json';
const origin='https://oposicvigo.vercel.app';
async function settings(){
 const r=await fetch(base+'/settings',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
 const json=await r.json().catch(()=>({}));
 if(!r.ok||json.success!==true)throw Error('Cloudflare settings HTTP '+r.status);
 return json.result;
}
function assert(ok,reason){if(!ok)throw Error('Publicación bloqueada: '+reason);}
function fingerprint(b){
 // Nunca leer ni imprimir contenido de secretos. Solo se compara su presencia y tipo.
 return JSON.stringify({name:b.name,type:b.type,id:b.id||null,namespace_id:b.namespace_id||null,text:b.type==='plain_text'?b.text:null,json:b.type==='json'?b.json:null});
}
async function smoke(path,method='GET',from=origin){
 const r=await fetch('https://rumbo-entrenador.jose-arial.workers.dev'+path,{method,headers:{Origin:from},cache:'no-store',signal:AbortSignal.timeout(15000)});
 return r;
}
let created=false;
try{
 const before=await settings();
 const bindings=before.bindings||[];
 assert(Array.isArray(before.bindings),'no se pudieron consultar bindings existentes');
 assert(new Set(bindings.map(x=>x.name)).size===bindings.length,'bindings duplicados');
 assert(bindings.every(b=>['secret_text','plain_text','json','kv_namespace','d1'].includes(b.type)),'binding de tipo desconocido');
 const notes=bindings.find(b=>b.name==='NOTES_KV'&&b.type==='kv_namespace');
 assert(notes?.namespace_id,'KV de diario no encontrado');
 assert(bindings.some(b=>b.name==='db'&&b.type==='d1'&&b.id===expectedDb),'base D1 no coincide');
 assert(bindings.some(b=>b.name==='RUMBO_ACCESS_TOKEN'&&b.type==='secret_text'),'secreto actual no encontrado');
 const origins=bindings.find(b=>b.name==='ALLOWED_ORIGIN');
 assert(origins?.type==='plain_text','orígenes de producción ausentes');
 const current=String(origins.text||'').split(',').map(x=>x.trim()).filter(Boolean);
 assert(requiredOrigins.every(x=>current.includes(x)),'faltan orígenes históricos o publicados');
 const config=configuration(before,notes.namespace_id);
 const desired=String(config.vars.ALLOWED_ORIGIN||'').split(',').filter(Boolean);
 assert(desired.length===current.length&&current.every(x=>desired.includes(x)),'la publicación cambiaría los orígenes CORS');
 assert(config.name===worker&&config.keep_vars===true,'configuración no preserva Worker/variables');
 assert(bindings.filter(b=>b.type==='kv_namespace').every(b=>config.kv_namespaces.some(x=>x.binding===b.name&&x.id===b.namespace_id)),'se perdería un KV');
 assert(bindings.filter(b=>b.type==='d1').every(b=>config.d1_databases.some(x=>x.binding===b.name&&x.database_id===b.id)),'se perdería una base D1');
 // No modificar las variables de facturación ni la autenticación.
 assert(Object.keys(config.vars).every(x=>x==='ALLOWED_ORIGIN'),'el despliegue intentaría modificar otras variables');
 await writeFile(path,JSON.stringify(config),{mode:0o600});created=true;
 const result=spawnSync('./node_modules/.bin/wrangler',['deploy','--config','.pr36-release-production.generated.json','--keep-vars'],{
  cwd:'rumbo-worker',encoding:'utf8',timeout:120000,
  env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account,WRANGLER_SEND_METRICS:'false'}
 });
 // No mostrar salida de Wrangler: puede contener variables del Worker.
 if(result.status!==0){
  const codes=(result.stdout+' '+result.stderr).match(/\[code: \d+\]/g)||[];
  throw Error('Fallo de despliegue protegido, códigos '+codes.join(','));
 }
 const after=await settings();
 assert(bindings.every(b=>{
  const currentBinding=(after.bindings||[]).find(x=>x.name===b.name);
  return currentBinding&&fingerprint(currentBinding)===fingerprint(b);
 }),'los bindings actuales no coinciden después del despliegue: revisar rollback');
 // Cloudflare puede servir versiones anteriores mientras propaga el despliegue.
 // No aceptar una respuesta 2xx para una ruta privada sin credenciales.
 let verified=0,finalStatus='';
 for(let i=0;i<40;i++){
  const notesRes=await smoke('/notes');
  const trainingRes=await smoke('/training');
  const pre=await smoke('/training','OPTIONS');
  const foreign=await smoke('/notes','GET','https://origen-no-autorizado.invalid');
  if([notesRes.status,trainingRes.status].some(status=>status>=200&&status<300))
   throw Error('Una ruta privada respondió sin autenticación: publicación no segura.');
  const ready=notesRes.status===401&&trainingRes.status===401&&
   pre.status===204&&pre.headers.get('access-control-allow-origin')===origin&&foreign.status===403;
  finalStatus='notes='+notesRes.status+', training='+trainingRes.status+', preflight='+pre.status+', origin='+foreign.status;
  if(ready)verified++;else verified=0;
  if(verified>=2)break;
  if(i<39)await new Promise(resolve=>setTimeout(resolve,1500));
 }
 assert(verified>=2,'no se confirmó propagación segura de /notes y /training ('+finalStatus+')');
 console.log('PASS: Worker actualizado; bindings del diario, D1, secretos y orígenes conservados.');
 console.log('PASS: autenticación no autorizada rechazada en /notes y /training; no se consultaron registros personales.');
 console.log('Backend listo para validación manual antes de publicar el frontend.');
}catch(e){
 // No intentar revertir secretos ni eliminar KV automáticamente en producción.
 console.error('AVISO: '+e.message+'; si llegó a desplegar, comprobar el historial de versiones de Cloudflare antes de volver a ejecutar.');
 process.exitCode=1;
}finally{
 if(created)await rm(path,{force:true});
}
