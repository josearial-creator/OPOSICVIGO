// Prueba temporal y aislada: Cloudflare real + dos navegadores, sin tocar recursos de producción.
import {randomBytes,webcrypto} from 'node:crypto';
import {writeFile,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from '../tests/node_modules/playwright/index.mjs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,apiToken=process.env.CLOUDFLARE_API_TOKEN;
const runId=String(process.env.GITHUB_RUN_ID||'').replace(/[^0-9]/g,'');
if(account!=='2bc103e4dec32961305599da77b877f6'||!apiToken||!runId)throw Error('Faltan credenciales de Cloudflare o identificador de ejecución; no se crean recursos.');
const script='rumbo-pr36-test-'+runId;
const prefix='rumbo-pr36-test-'+runId;
const base='https://api.cloudflare.com/client/v4/accounts/'+account;
let kvId=null,workerCreated=false,server,browser;
const cfg='rumbo-worker/pr36-staging.generated.json';
const password=randomBytes(36).toString('base64url');
async function cf(path,method='GET',body){
 const res=await fetch(base+path,{method,headers:{Authorization:'Bearer '+apiToken,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const data=await res.json().catch(()=>null);
 if(!res.ok||!data?.success)throw Error('Cloudflare '+method+' HTTP '+res.status+' (sin datos sensibles)');
 return data.result;
}
const b64=x=>Buffer.from(x).toString('base64');
const headers={'Origin':'http://127.0.0.1:8086'};
async function main(){
 const subdomain=(await cf('/workers/subdomain'))?.subdomain;
 if(!subdomain||!/^[a-z0-9-]+$/.test(subdomain))throw Error('No se pudo verificar el subdominio Worker; no desplegar.');
 // KV separada: jamás enlazar NOTES_KV de producción ni D1.
 kvId=(await cf('/storage/kv/namespaces','POST',{title:prefix})).id;
 if(!kvId)throw Error('KV temporal no creada.');
 const config={name:script,main:'worker.mjs',compatibility_date:'2026-01-01',workers_dev:true,observability:{enabled:false},kv_namespaces:[{binding:'NOTES_KV',id:kvId}],vars:{ALLOWED_ORIGIN:'http://127.0.0.1:8086',FREE_TIER_CONFIRMED:'false'}};
 await writeFile(cfg,JSON.stringify(config),{mode:0o600});
 const deployment=spawnSync('./node_modules/.bin/wrangler',['deploy','--config','pr36-staging.generated.json'],{cwd:'rumbo-worker',env:{...process.env,WRANGLER_SEND_METRICS:'false'},encoding:'utf8',timeout:120000});
 workerCreated=true; // intentar limpieza incluso si Wrangler devuelve error parcial
 if(deployment.status!==0)throw Error('No se completó el despliegue temporal; se intentará limpiarlo. Código '+deployment.status);
 await cf('/workers/scripts/'+script+'/secrets','PUT',{type:'secret_text',name:'RUMBO_ACCESS_TOKEN',text:password});
 const workerURL='https://'+script+'.'+subdomain+'.workers.dev';
 // Servidor web real, efímero, con el código del PR, en GitHub Actions.
 server=createServer(async(req,res)=>{
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  const p=new URL(req.url,'http://127.0.0.1:8086').pathname;
  if(p.includes('..')||!/^\/[a-zA-Z0-9_./-]*$/.test(p)){res.writeHead(403);res.end();return;}
  const {readFile}=await import('node:fs/promises');
  try{const file=await readFile('docs/rumbo'+(p==='/'?'/index.html':p));
   res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.json')?'application/json':'text/html');res.end(file);
  }catch{res.writeHead(404);res.end('No encontrado');}
 });
 server.listen(8086,'127.0.0.1');await once(server,'listening');
 const executable=process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||undefined);
 browser=await chromium.launch({headless:true,...(executable?{executablePath:executable}:{}),args:['--no-sandbox']});
 async function newPage(width){
  const context=await browser.newContext({viewport:{width,height:820}});
  await context.addInitScript(url=>localStorage.setItem('rumbo-ai-endpoint',url),workerURL);
  const page=await context.newPage();
  page.on('dialog',dialog=>dialog.accept());
  await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({json:[]}));
  await page.goto('http://127.0.0.1:8086/#ev-training');
  await page.locator('#er-connect').waitFor();
  return {page,context};
 }
 const desktop=await newPage(1200),mobile=await newPage(390);
 for(const instance of [desktop,mobile]){
  await instance.page.locator('#er-pass').fill(password);
  await instance.page.locator('#er-connect').click();
  await instance.page.locator('#er-private').waitFor({state:'visible',timeout:20000});
 }
 const fields={situacion:'situación sintética PR36',pensamiento:'pensamiento sintético PR36',emocion:'emoción sintética PR36',conducta:'conducta sintética PR36'};
 for(const [key,val]of Object.entries(fields))await desktop.page.locator('#er-form [name='+key+']').fill(val);
 await desktop.page.locator('#er-save').click();
 await desktop.page.waitForFunction(()=>document.querySelector('#er-status')?.textContent.includes('Guardado cifrado confirmado'),{timeout:45000});
 // El valor KV realmente escrito se compara por su forma y no se imprime.
 const apiHeaders={...headers,Authorization:'Rumbo '+b64(password)};
 const endpoint=workerURL+'/training';
 let saved;
 for(let n=0;n<10;n++){
  const response=await fetch(endpoint,{headers:apiHeaders});
  if(!response.ok)throw Error('GET remoto '+response.status);
  const data=await response.json();
  if(data.records?.length===1){saved=data.records[0];break;}
  await new Promise(resolve=>setTimeout(resolve,1500));
 }
 if(!saved)throw Error('Cloudflare KV no devolvió el registro cifrado guardado');
 const raw=JSON.stringify(saved);
 if(!saved.cipher||Object.values(fields).some(value=>raw.includes(value)))throw Error('Datos personales visibles en payload Cloudflare');
 await mobile.page.locator('#er-refresh').click();
 await mobile.page.locator('#er-body tr').first().waitFor({timeout:30000});
 const body=await mobile.page.locator('#er-body').innerText();
 if(!Object.values(fields).every(value=>body.includes(value)))throw Error('Segunda sesión no pudo descifrar el registro');
 await desktop.page.reload();
 await desktop.page.locator('#er-pass').fill(password);
 await desktop.page.locator('#er-connect').click();
 await desktop.page.locator('#er-body tr').first().waitFor({timeout:30000});
 const id=saved.id;
 const unauthorized=await fetch(workerURL+'/training',{headers:{...headers,Authorization:'Rumbo '+b64('contraseña-incorrecta')}});
 if(unauthorized.status!==401)throw Error('Acceso no autorizado no fue rechazado');
 const cors=await fetch(workerURL+'/training',{headers:{...apiHeaders,Origin:'https://sitio-no-confiable.invalid'}});
 if(cors.status!==403)throw Error('Origen no autorizado no fue rechazado');
 await mobile.page.locator('#er-body [data-er-delete]').click();
 await mobile.page.locator('#er-empty').waitFor({state:'visible',timeout:30000});
 await desktop.page.locator('#er-refresh').click();
 await desktop.page.locator('#er-empty').waitFor({state:'visible',timeout:30000});
 if(!id)throw Error('Registro sin ID');
 await desktop.context.close();await mobile.context.close();
 console.log('PASS: Worker real y KV temporal; cifrado en navegador, recarga, segundo navegador, autenticación, aislamiento y borrado.');
}
try{await main();}finally{
 if(browser)await browser.close().catch(()=>{});
 if(server)await new Promise(resolve=>server.close(resolve));
 await unlink(cfg).catch(()=>{});
 if(workerCreated)try{await cf('/workers/scripts/'+script,'DELETE');console.log('Worker temporal eliminado');}catch{console.error('ALERTA: revisar y eliminar Worker temporal '+script);}
 if(kvId)try{await cf('/storage/kv/namespaces/'+kvId,'DELETE');console.log('KV temporal eliminada');}catch{console.error('ALERTA: revisar y eliminar KV temporal '+prefix);}
}
