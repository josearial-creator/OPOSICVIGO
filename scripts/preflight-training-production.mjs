// Preflight exclusivamente READ-ONLY del despliegue PR36 a rumbo-entrenador.
// Inspecciona tipos/IDs de bindings (NUNCA valores de secretos ni notas), verifica
// conservacion y compila en dry-run. No hace deploy ni cambia Workers, KV o D1.
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {configuration} from './activate-notes-20261114.mjs';
const account='2bc103e4dec32961305599da77b877f6';
const name='rumbo-entrenador';
const token=process.env.CLOUDFLARE_API_TOKEN;
const expectedDb='7752c042-d26f-4a4b-8b81-5bdbf17ff0fd';
const requiredOrigins=['https://oposicvigo.vercel.app','https://josearial-creator.github.io','https://josearial-creatorgithubio.vercel.app'];
if(!token||/\s/.test(token))throw Error('Falta credencial válida del preflight de solo lectura.');
const root='https://api.cloudflare.com/client/v4/accounts/'+account;
function check(value,label){if(!value)throw Error('BLOQUEADO: '+label);}
async function get(url){
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
 const obj=await response.json().catch(()=>({}));
 if(!response.ok||obj.success!==true)throw Error('Cloudflare lectura HTTP '+response.status+', códigos '+(obj.errors||[]).map(e=>e.code).join(','));
 return obj.result;
}
const output=await mkdtemp(join(tmpdir(),'rumbo-pr36-preflight-'));
const configFile='rumbo-worker/.pr36-release-readonly.generated.json';
try{
 const settings=await get(root+'/workers/scripts/'+name+'/settings');
 const binds=settings.bindings;
 check(Array.isArray(binds)&&binds.length>0,'no se pudieron verificar los bindings existentes');
 const allNames=binds.map(b=>b.name);
 check(allNames.every(x=>typeof x==='string'&&x),'binding sin nombre');
 check(new Set(allNames).size===allNames.length,'nombres de binding repetidos');
 const acceptable=new Set(['d1','kv_namespace','secret_text','plain_text','json']);
 check(binds.every(x=>acceptable.has(x.type)),'binding desconocido: revisión manual necesaria');
 const d1=binds.filter(b=>b.type==='d1');
 check(d1.length===1&&d1[0].name==='db'&&d1[0].id===expectedDb,'D1 rumbo-db no coincide con producción');
 const notes=binds.filter(b=>b.name==='NOTES_KV');
 check(notes.length===1&&notes[0].type==='kv_namespace'&&/^[0-9a-f]{32}$/i.test(notes[0].namespace_id),'NOTES_KV existente no verificado');
 const auth=binds.filter(b=>b.name==='RUMBO_ACCESS_TOKEN');
 check(auth.length===1&&auth[0].type==='secret_text','falta secreto de acceso existente');
 const origins=binds.find(b=>b.name==='ALLOWED_ORIGIN');
 check(origins?.type==='plain_text','orígenes actuales no verificados');
 const current=String(origins.text||'').split(',').map(x=>x.trim()).filter(Boolean);
 check(requiredOrigins.every(x=>current.includes(x)),'origen publicado no autorizado');
 check(current.every(x=>{try{return new URL(x).origin===x&&x.startsWith('https://')}catch{return false}}),'origen inválido');
 const proposed=configuration(settings,notes[0].namespace_id);
 check(proposed.name===name&&proposed.keep_vars===true,'la configuración no conserva variables existentes');
 check(proposed.vars&&Object.keys(proposed.vars).length===1&&proposed.vars.ALLOWED_ORIGIN,'configuración intenta sustituir variables');
 check(new Set(proposed.vars.ALLOWED_ORIGIN.split(',')).size===new Set(current).size&&current.every(x=>proposed.vars.ALLOWED_ORIGIN.split(',').includes(x)),'la actualización modificaría los orígenes CORS');
 check(binds.filter(b=>b.type==='kv_namespace').every(b=>proposed.kv_namespaces.some(x=>x.binding===b.name&&x.id===b.namespace_id)),'la actualización perdería un KV');
 check(binds.filter(b=>b.type==='d1').every(b=>proposed.d1_databases.some(x=>x.binding===b.name&&x.database_id===b.id)),'la actualización perdería D1');
 // Los secretos existentes deben conservarse con Wrangler --keep-vars; no se leen
 // ni se incorporan a archivos de configuración o a mensajes de CI.
 check(binds.filter(b=>b.type==='secret_text').every(b=>!Object.hasOwn(proposed.vars,b.name)),'intento de pasar secretos a variables');
 await writeFile(configFile,JSON.stringify(proposed),{mode:0o600});
 const compiled=spawnSync('./node_modules/.bin/wrangler',['deploy','--dry-run','--config','.pr36-release-readonly.generated.json','--outdir',output],{
  cwd:'rumbo-worker',encoding:'utf8',timeout:90000,
  env:{...process.env,CLOUDFLARE_API_TOKEN:'',WRANGLER_SEND_METRICS:'false'}
 });
 if(compiled.status!==0)throw Error('Compilación del Worker PR36 falló, salida '+compiled.status+'; no se ha desplegado');
 console.log('PASS: Worker rumbo-entrenador preexistente, secreto de acceso, KV y D1 preservados en el plan de publicación.');
 console.log('PASS: orígenes sin cambios, secretos sin divulgar y Worker compilado sin despliegue.');
 console.log('Resultado: preflight de solo lectura aprobado. NO se ha publicado nada.');
}finally{
 await Promise.allSettled([rm(configFile,{force:true}),rm(output,{recursive:true,force:true})]);
}
