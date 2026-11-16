// Compila los dos estados del Worker temporal sin credenciales ni conexión a Cloudflare.
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const temp=await mkdtemp(join(tmpdir(),'rumbo-training-build-'));
const config=resolve('rumbo-worker','.training-dry-run.generated.json');
try{
 for(const [kind,settings] of [
  ['active',{name:'rumbo-entrenamiento-pr36-test',main:'worker.mjs',compatibility_date:'2026-01-01',workers_dev:true,kv_namespaces:[{binding:'NOTES_KV',id:'00000000000000000000000000000000'}],vars:{ALLOWED_ORIGIN:'https://oposicvigo.vercel.app',FREE_TIER_CONFIRMED:'false'},observability:{enabled:false}}],
  ['disabled',{name:'rumbo-entrenamiento-pr36-test',main:'staging-disabled.mjs',compatibility_date:'2026-01-01',workers_dev:true,observability:{enabled:false}}]
 ]){
  await writeFile(config,JSON.stringify(settings),{mode:0o600});
  const out=join(temp,kind);
  const command=spawnSync('./node_modules/.bin/wrangler',['deploy','--dry-run','--outdir',out,'--config','.training-dry-run.generated.json'],{cwd:'rumbo-worker',encoding:'utf8',timeout:60000,env:{...process.env,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_API_TOKEN:''}});
  if(command.status!==0){console.error('ERROR: no compila Worker temporal '+kind+'; exit='+command.status);process.exitCode=1;}
  else console.log('PASS: Worker temporal '+kind+' compilado sin desplegar.');
 }
}finally{await Promise.allSettled([rm(config,{force:true}),rm(temp,{recursive:true,force:true})]);}
