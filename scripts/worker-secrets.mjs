const {CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:cf,GEMINI_API_KEY:gemini,RUMBO_ACCESS_TOKEN:password}=process.env;
function fail(message){console.log('::error::'+message);process.exit(1);}
if(!/^[a-f0-9]{32}$/i.test(account||'')||!cf)fail('Falta la configuración Cloudflare.');
if(!gemini||/\s/.test(gemini))fail('Falta GEMINI_API_KEY válida en GitHub Secrets.');
if(!password)fail('No existe un secreto de repositorio accesible llamado RUMBO_ACCESS_TOKEN. Añádelo en OPOSICVIGO → Settings → Secrets and variables → Actions → Repository secrets.');
if(password.length<32)fail('RUMBO_ACCESS_TOKEN está guardado, pero tiene menos de 32 caracteres. Edita ese secreto y usa una contraseña más larga.');
if(password.length>64)fail('RUMBO_ACCESS_TOKEN está guardado, pero supera los 64 caracteres. Edita ese secreto para usar 32–64 caracteres.');
if(/\s/.test(password))fail('RUMBO_ACCESS_TOKEN está guardado, pero contiene espacios o saltos de línea. Edita ese secreto y elimínalos.');
if([gemini,cf,account].includes(password))fail('RUMBO_ACCESS_TOKEN debe ser una contraseña independiente, no una clave API o identificador.');
if(process.env.CHECK_ONLY==='true'){console.log('::notice::Los secretos requeridos están presentes y tienen formato válido. No se muestran sus valores.');process.exit(0);}
for(const [name,text] of [['GEMINI_API_KEY',gemini],['RUMBO_ACCESS_TOKEN',password]]){
try{
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/rumbo-entrenador/secrets`,{method:'PUT',headers:{Authorization:'Bearer '+cf,'Content-Type':'application/json'},body:JSON.stringify({name,text,type:'secret_text'}),signal:AbortSignal.timeout(25000)});
 const result=await response.json();if(!response.ok||!result.success)fail(`No se pudo guardar ${name} en Cloudflare: HTTP ${response.status}. Revisa permisos del token.`);
 console.log('Secreto '+name+' guardado en Cloudflare. Valor oculto.');
}catch{fail('No se pudo completar la transferencia segura de secretos.');}
}
