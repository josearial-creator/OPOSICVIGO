// Prueba real del PR #36 sobre un Worker PREEXISTENTE creado desde Cloudflare.
// No crea ni borra Workers. Nunca usa recursos de producción ni registros personales.
import {writeFile,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomBytes,randomUUID,webcrypto} from 'node:crypto';

const account='2bc103e4dec32961305599da77b877f6';
const staging='fancy-sea-977drumbo-entrenamiento-pr36-test';
const origin='https://oposicvigo.vercel.app';
const accountSubdomain='jose-arial';
const base=`https://api.cloudflare.com/client/v4/accounts/${account}`;
const workerUrl=`${base}/workers/scripts/${staging}`;
const namespaceUrl=`${base}/storage/kv/namespaces`;
const endpoint=`https://${staging}.${accountSubdomain}.workers.dev`;
const token=process.env.CLOUDFLARE_API_TOKEN;
const run=String(process.env.GITHUB_RUN_ID||'').replace(/[^0-9]/g,'');
if(!token||!run)throw Error('Falta token de GitHub o identificador de ejecución.');
if(process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.CLOUDFLARE_ACCOUNT_ID!==account)throw Error('Cuenta de Cloudflare inesperada: sin cambios.');
const config='rumbo-worker/release-training-test.generated.json';
const disableConfig='rumbo-worker/release-training-disabled.generated.json';
let namespaceId=null,modified=false,resetConfirmed=false, testId=null;
const password=randomBytes(48).toString('hex');
const auth='Rumbo '+Buffer.from(password,'utf8').toString('base64');
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=bytes=>Buffer.from(bytes).toString('base64');
const un64=text=>Buffer.from(text,'base64');
async function cf(url,method='GET',data){
 const response=await fetch(url,{method,headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(25000)});
 const value=await response.json().catch(()=>({}));
 if(!response.ok||value.success!==true)throw Error('Cloudflare '+method+' HTTP '+response.status+' codes '+(value.errors||[]).map(x=>x.code).join(','));
 return value.result;
}
function wrangler(configFile){
 const result=spawnSync('./node_modules/.bin/wrangler',['deploy','--config',configFile],{cwd:'rumbo-worker',encoding:'utf8',timeout:90000,env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account,WRANGLER_SEND_METRICS:'false'}});
 if(result.status!==0){
  const raw=(result.stdout||'')+' '+(result.stderr||'');
  const codes=[...new Set(raw.match(/\[code: \d+\]/g)||[])].join(',');
  throw Error('Staging Wrangler deploy failed; codes='+codes+'; exit='+result.status);
 }
}
// Wrangler secret put despliega la nueva versión inmediatamente. La API /secrets
// puede crear una versión sin activarla, y /settings seguir mostrando la anterior.
// Es obligatorio pasar tanto --config como --name para evitar afectar a producción.
function putStagingSecret(){
 const args=['secret','put','RUMBO_ACCESS_TOKEN','--config','release-training-test.generated.json','--name',staging];
 const result=spawnSync('./node_modules/.bin/wrangler',args,{
  cwd:'rumbo-worker',input:password+'\n',encoding:'utf8',timeout:90000,
  env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account,WRANGLER_SEND_METRICS:'false'}
 });
 if(result.status!==0){
  const raw=(result.stdout||'')+' '+(result.stderr||'');
  const codes=[...new Set(raw.match(/\[code: \d+\]/g)||[])].join(',');
  throw Error('Staging secret deploy failed; codes='+codes+'; exit='+result.status);
 }
}
async function req(method,path,body,from=origin,authorized=true){
 return fetch(endpoint+path,{method,headers:{Origin:from,...(authorized?{Authorization:auth}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(18000)});
}
async function key(salt){
 const raw=await webcrypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 return webcrypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:180000,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function expectEventually(label,method,path,expected,authorized,from=origin){
 let last=-1;
 for(let attempt=0;attempt<25;attempt++){
  last=(await req(method,path,undefined,from,authorized)).status;
  if(last===expected)return;
  // Nunca aceptar un acceso autorizado cuando se espera denegación.
  if(last>=200&&last<300)throw Error(label+' incorrecto: HTTP '+last);
  if(![404,410,502,503,504].includes(last))throw Error(label+' incorrecto: HTTP '+last);
  if(attempt<24)await new Promise(resolve=>setTimeout(resolve,1500));
 }
 throw Error(label+' no confirmado tras reintentos: último HTTP '+last);
}
async function smoke(){
 await expectEventually('CORS','OPTIONS','/training',204,false);
 await expectEventually('Acceso anónimo','GET','/training',401,false);
 await expectEventually('Origen externo','GET','/training',403,true,'https://origen-no-permitido.invalid');
 await expectEventually('Lectura autenticada','GET','/training',200,true);
 const data={situacion:'situación ficticia',pensamiento:'pensamiento ficticio',emocion:'emoción ficticia',conducta:'pausa ficticia'};
 const salt=randomBytes(16),iv=randomBytes(12);
 const encrypted=await webcrypto.subtle.encrypt({name:'AES-GCM',iv},await key(salt),enc.encode(JSON.stringify(data)));
 testId=randomUUID();
 const item={version:1,id:testId,date:new Date().toISOString(),salt:b64(salt),iv:b64(iv),cipher:b64(encrypted)};
 const post=await req('POST','/training',item);
 if(post.status!==201)throw Error('Guardado HTTP '+post.status);
 let saved;
 for(let i=0;i<24;i++){
  const r=await req('GET','/training');
  if(r.status!==200)throw Error('Lectura HTTP '+r.status);
  saved=(await r.json()).records?.find(x=>x.id===testId);
  if(saved)break;
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 if(!saved)throw Error('El KV temporal no devolvió el registro.');
 const plaintext=dec.decode(await webcrypto.subtle.decrypt({name:'AES-GCM',iv:un64(saved.iv)},await key(un64(saved.salt)),un64(saved.cipher)));
 if(JSON.stringify(JSON.parse(plaintext))!==JSON.stringify(data))throw Error('El descifrado no coincide.');
 if((await req('POST','/training',item)).status!==200)throw Error('Reintento no idempotente.');
 if((await req('DELETE','/training/'+testId)).status!==200)throw Error('Borrado no confirmado.');
 for(let i=0;i<24;i++){
  const r=await req('GET','/training');
  if(r.status===200&&!((await r.json()).records||[]).some(x=>x.id===testId)){
   console.log('PASS: Cloudflare real, KV aislado, autenticación, CORS, cifrado, lectura y borrado.');
   return;
  }
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw Error('Borrado no reflejado en KV temporal.');
}
try {
 const sub=await cf(base+'/workers/subdomain');
 if(sub?.subdomain!==accountSubdomain)throw Error('Subdominio de la cuenta no coincide. Sin cambios.');
 // El titular debe crear previamente el Worker vacío desde el panel.
 let initial;
 try{initial=await cf(workerUrl+'/settings');}catch(e){throw Error('El Worker de prueba todavía no existe o no es accesible; créalo desde Cloudflare antes de ejecutar. '+e.message);}
 const bindings=initial?.bindings||[];
 if(bindings.length>0)throw Error('El Worker de prueba tiene bindings existentes: operación bloqueada para no sobrescribirlos.');
 console.log('PASS: Worker temporal preexistente con cero bindings. No se creará ningún Worker.');
 const namespace=await cf(namespaceUrl,'POST',{title:'rumbo-training-test-'+run});
 namespaceId=namespace.id;
 await writeFile(config,JSON.stringify({
  name:staging,main:'worker.mjs',compatibility_date:'2026-01-01',workers_dev:true,
  kv_namespaces:[{binding:'NOTES_KV',id:namespaceId}],
  vars:{ALLOWED_ORIGIN:origin,FREE_TIER_CONFIRMED:'false'},observability:{enabled:false}
 }),{mode:0o600});
 // Solo modificar el Worker temporal después de confirmar que ya existe.
 modified=true;
 wrangler('release-training-test.generated.json');
 putStagingSecret();
 let ready=false,authBinding=false,kvBinding=false,lastStatus=0,lastAuthenticated=0,confirmed=0;
 // Confirma DOS lecturas consecutivas correctas para reducir falsos positivos de propagación.
 for(let i=0;i<70;i++){
  const active=await cf(workerUrl+'/settings');
  authBinding=!!active.bindings?.some(b=>b.name==='RUMBO_ACCESS_TOKEN'&&b.type==='secret_text');
  kvBinding=!!active.bindings?.some(b=>b.name==='NOTES_KV'&&b.type==='kv_namespace'&&b.namespace_id===namespaceId);
  lastStatus=(await req('GET','/training',undefined,origin,false)).status;
  lastAuthenticated=(await req('GET','/training',undefined,origin,true)).status;
  if(authBinding&&kvBinding&&lastStatus===401&&lastAuthenticated===200)confirmed++;
  else confirmed=0;
  if(confirmed>=2){ready=true;break;}
  if(lastStatus>=200&&lastStatus<300)throw Error('Acceso anónimo inesperadamente permitido: HTTP '+lastStatus);
  if(![401,404,410,502,503,504].includes(lastStatus)||![200,404,410,502,503,504].includes(lastAuthenticated))
   throw Error('Estado inesperado del Worker de pruebas: anónimo HTTP '+lastStatus+', autenticado HTTP '+lastAuthenticated);
  if(i<69)await new Promise(resolve=>setTimeout(resolve,1500));
 }
 if(!ready)throw Error('No se confirmó propagación de autenticación y KV: auth='+authBinding+', kv='+kvBinding+', anónimo HTTP='+lastStatus+', autenticado HTTP='+lastAuthenticated);
 await smoke();
} catch(e) {
 console.error('Prueba aislada fallida: '+e.message);
 process.exitCode=1;
} finally {
 // El Worker se conserva, pero se convierte en una página inerte, sin datos ni secretos.
 if(modified){
  try{
   await writeFile(disableConfig,JSON.stringify({
    name:staging,main:'staging-disabled.mjs',compatibility_date:'2026-01-01',
    workers_dev:true,observability:{enabled:false}
   }),{mode:0o600});
   wrangler('release-training-disabled.generated.json');
   let after=await cf(workerUrl+'/settings');
   const secret=after.bindings?.find(b=>b.name==='RUMBO_ACCESS_TOKEN'&&b.type==='secret_text');
   if(secret)await cf(workerUrl+'/secrets/RUMBO_ACCESS_TOKEN','DELETE');
   after=await cf(workerUrl+'/settings');
   if(after.bindings?.some(b=>['RUMBO_ACCESS_TOKEN','NOTES_KV','db'].includes(b.name)))throw Error('Binding temporal aún activo; no eliminar KV hasta revisión.');
   resetConfirmed=true;
   console.log('PASS: Worker temporal restaurado a modo inerte sin secreto ni KV vinculado.');
  }catch(e){
   console.error('IMPORTANTE: no se confirmó la restauración del Worker temporal: '+e.message);
   process.exitCode=1;
  }
 }
 if(namespaceId){
  if(!modified||resetConfirmed){
   try{
    await cf(namespaceUrl+'/'+namespaceId,'DELETE');
    console.log('PASS: KV temporal eliminado; no se consultaron datos del usuario.');
   }catch(e){console.error('IMPORTANTE: falló la eliminación del KV temporal: '+e.message);process.exitCode=1;}
  }else{
   console.error('IMPORTANTE: KV temporal conservado por seguridad; requiere limpieza manual.');
   process.exitCode=1;
  }
 }
 await Promise.allSettled([unlink(config),unlink(disableConfig)]);
 console.log('Worker de pruebas preexistente conservado, sin acceso a datos de producción.');
}
