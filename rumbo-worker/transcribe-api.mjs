// Transcripción explícita: audio breve solo en memoria, sin logs, D1 ni KV.
// Se invoca después de autenticar y verificar el origen en worker.mjs.
const MAX_JSON_BYTES=550000;
const MAX_AUDIO_BYTES=350000;
const TYPES=new Set(['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-wav']);
export async function transcribeApi(request,env){
 const json=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(request.method!=='POST')return json(405,{error:'Método no permitido'});
 if(env.FREE_TIER_CONFIRMED!=='true'||!env.GEMINI_API_KEY)return json(503,{error:'Transcripción no activada: confirma primero la modalidad gratuita y configura el secreto Gemini.'});
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json(415,{error:'Se requiere JSON'});
 const declared=Number(request.headers.get('Content-Length'));
 if(Number.isFinite(declared)&&declared>MAX_JSON_BYTES)return json(413,{error:'Audio demasiado grande'});
 let raw='';
 try{
  // Cortar lectura al alcanzar el límite; no registrar el contenido.
  const reader=request.body?.getReader();if(!reader)return json(400,{error:'Solicitud vacía'});
  const parts=[];let n=0;
  for(;;){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>MAX_JSON_BYTES){await reader.cancel();return json(413,{error:'Audio demasiado grande'});}parts.push(value);}
  const bytes=new Uint8Array(n);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
  raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 }catch{return json(400,{error:'No se pudo leer el audio'});}
 let data;
 try{data=JSON.parse(raw);}catch{return json(400,{error:'JSON no válido'});}
 const mime=String(data?.mimeType||'').split(';')[0].toLowerCase().trim();
 const b64=data?.audioBase64;
 if(!TYPES.has(mime)||typeof b64!=='string'||b64.length<120||b64.length>470000||!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)||b64.length%4!==0)return json(400,{error:'Formato de audio no válido'});
 const approximateBytes=b64.length*3/4-(b64.endsWith('==')?2:b64.endsWith('=')?1:0);
 if(approximateBytes>MAX_AUDIO_BYTES)return json(413,{error:'Máximo de audio superado; graba un fragmento más corto'});
 try{
  // Un único intento. Sin fallback automático ni colas de facturación.
  const upstream=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',{
   method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
   signal:AbortSignal.timeout(25000),
   body:JSON.stringify({contents:[{role:'user',parts:[
    {text:'Transcribe literalmente en español el audio adjunto. Devuelve solo las palabras pronunciadas, sin explicaciones ni datos añadidos.'},
    {inlineData:{mimeType:mime,data:b64}}
   ]}],generationConfig:{temperature:0,maxOutputTokens:1100}})
  });
  if(upstream.status===429)return json(429,{error:'Se ha alcanzado la cuota disponible; usa el dictado del navegador.'});
  if(!upstream.ok)return json(502,{error:'No se pudo transcribir con Gemini. Usa el dictado del navegador.'});
  const payload=await upstream.json();
  const transcript=String(payload.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('')||'').trim().slice(0,4000);
  if(!transcript)return json(502,{error:'No se reconoció texto; vuelve a grabar un fragmento breve.'});
  return json(200,{text:transcript,provider:'Gemini'});
 }catch{return json(502,{error:'Transcripción no disponible. No se ha guardado el audio.'});}
}
