// Comprueba la compilación del Worker de pruebas sin conexión ni recursos Cloudflare.
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const temp=await mkdtemp(join(tmpdir(),'rumbo-training-build-'));
const config=resolve('rumbo-worker','.training-dry-run.generated.json');
try{
 await writeFile(config,JSON.stringify({name:'rumbo-entrenamiento-pr36-test',main:'worker.mjs',compatibility_date:'2026-01-01',workers_dev:true,kv_namespaces:[{binding:'NOTES_KV',id:'00000000000000000000000000000000'}],vars:{ALLOWED_ORIGIN:'https://oposicvigo.vercel.app',FREE_TIER_CONFIRMED:'false'},observability:{enabled:false}}),{mode:0o600});
 const command=spawnSync('./node_modules/.bin/wrangler',['deploy','--dry-run','--outdir',temp,'--config','.training-dry-run.generated.json'],{cwd:'rumbo-worker',encoding:'utf8',timeout:60000,env:{...process.env,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_API_TOKEN:''}});
 if(command.status!==0){console.error('ERROR: el Worker aislado no se compiló. Código de salida: '+command.status);process.exitCode=1;}
 else console.log('PASS: Worker de Entrenamiento compilado sin tocar Cloudflare.');
}finally{await Promise.allSettled([rm(config,{force:true}),rm(temp,{recursive:true,force:true})]);}
