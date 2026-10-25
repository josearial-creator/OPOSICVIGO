import worker from '../rumbo-worker/worker.mjs';
import { randomBytes } from 'node:crypto';
const key=process.env.GEMINI_API_KEY;
if(!key||/\s/.test(key)){console.log('::error::Falta GEMINI_API_KEY o contiene espacios/saltos de línea. Corrige el secreto en GitHub.');process.exit(1);}
if(process.env.LIST_MODELS_ONLY==='true'){
 try{
 const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(20000)});
 if(!r.ok){console.log('::error::No se pudo consultar el catálogo de modelos: HTTP '+r.status);process.exit(1);}
 const list=await r.json();const names=(list.models||[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent')&&/^models\/gemini-.*flash/.test(m.name)&&!/(image|tts|audio|live)/.test(m.name)).map(m=>m.name).filter(n=>/^[A-Za-z0-9/_.-]+$/.test(n));
 console.log('::notice title=Modelos de texto disponibles::'+names.join(', '));process.exit(0);
 }catch{console.log('::error::No se pudo consultar el catálogo; no se activan servicios.');process.exit(1);}
}
const nativeFetch=globalThis.fetch;let upstreamStatus=null,upstreamReason=null;
globalThis.fetch=async(...args)=>{const response=await nativeFetch(...args);upstreamStatus=response.status;if(!response.ok){try{const error=await response.clone().json();const reason=error?.error?.status;if(typeof reason==='string'&&/^[A-Z_]+$/.test(reason))upstreamReason=reason;}catch{}}return response;};
const password=randomBytes(32).toString('hex');
const origin='https://josearial-creator.github.io';
const example={scenario:'Un compañero dice que un informe contiene errores. Responde con respeto y pide aclaraciones.',skill:'Escucha activa',criteria:['Resume la preocupación de la otra persona','Pide un ejemplo concreto sin hacer suposiciones'],response:'Entiendo que te preocupa la calidad del informe. ¿Puedes señalar un error concreto para revisarlo contigo?',history:[]};
try{
const result=await worker.fetch(new Request('https://worker.test/chat',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+password,'Content-Type':'application/json'},body:JSON.stringify(example)}),{ALLOWED_ORIGIN:origin,FREE_TIER_CONFIRMED:'true',GEMINI_API_KEY:key,RUMBO_ACCESS_TOKEN:password});
const body=await result.json();
if(result.status!==200||body.provider!=='Gemini'||body.evaluable!==true||!body.criteria?.every(x=>Number.isInteger(x)&&x>=0&&x<=4)){
 console.log(`::error::Prueba Gemini no superada: respuesta ${result.status}, proveedor HTTP ${upstreamStatus??'no disponible'}, estado ${upstreamReason??'sin detalle'}. No se activa IA ni se cambia de modelo o plan.`);
 process.exitCode=1;
}else console.log('::notice::Gemini real respondió al ejemplo ficticio con el JSON y los criterios esperados. No se han enviado datos personales ni activado facturación.');
}catch{console.log('::error::La consulta real a Gemini no pudo completarse. No se muestran credenciales ni se activa IA.');process.exitCode=1;}
