// Archivo remoto del historial: instantáneas cifradas, inmutables y separadas de las notas.
// La autenticación y CORS se comprueban ANTES en worker.mjs. Nunca recibe texto claro.
const PREFIX='private-history/v1/owner/';
const json=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const validId=id=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
const b64=s=>typeof s==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(s);
const valid=(v,max=5000)=>v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).sort().join(',')==='cipher,count,createdAt,id,iv,salt,version'&&
 v.version===1&&validId(v.id)&&Number.isInteger(v.count)&&v.count>0&&v.count<=max&&
 typeof v.createdAt==='string'&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(v.createdAt)&&Number.isFinite(Date.parse(v.createdAt))&&
 b64(v.salt)&&v.salt.length===24&&b64(v.iv)&&v.iv.length===16&&
 b64(v.cipher)&&v.cipher.length>=24&&v.cipher.length<=6000000;
export async function historyApi(request,env,path,options={}){
 const route=options.route||'/history',prefix=options.prefix||PREFIX,max=options.max||5000;
 if(!env.NOTES_KV)return json(503,{error:'Almacén privado no configurado. No se ha guardado nada.'});
 const suffix=path.slice(route.length),id=suffix.startsWith('/')?suffix.slice(1):'';
 if(suffix&&(!validId(id)||suffix!=='/'+id))return json(404,{error:'Archivo no encontrado'});
 if(request.method==='GET'&&id){
  const item=await env.NOTES_KV.get(prefix+id,'json');
  return item&&valid(item,max)?json(200,{snapshot:item}):json(404,{error:'Archivo no encontrado'});
 }
 if(request.method==='GET'&&!id){
  const url=new URL(request.url),cursor=url.searchParams.get('cursor')||undefined;
  if(cursor&&(cursor.length>1024||!/^[a-zA-Z0-9+/=_-]+$/.test(cursor)))return json(400,{error:'Cursor no válido'});
  const page=await env.NOTES_KV.list({prefix,limit:50,...(cursor?{cursor}:{})});
  const versions=page.keys.filter(x=>validId(x.name.slice(prefix.length))).map(x=>({
   id:x.name.slice(prefix.length),count:Number.isInteger(x.metadata?.count)?x.metadata.count:null,
   createdAt:typeof x.metadata?.createdAt==='string'?x.metadata.createdAt:null
  }));
  return json(200,{versions,cursor:page.list_complete?null:page.cursor});
 }
 if(request.method==='POST'&&!id){
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json(415,{error:'Se requiere JSON'});
  let value;
  try{
   const raw=await request.text();
   if(raw.length>6100000)return json(413,{error:'Archivo demasiado grande'});
   value=JSON.parse(raw);
  }catch{return json(400,{error:'Archivo cifrado no válido'});}
  if(!valid(value,max))return json(400,{error:'Archivo cifrado no válido'});
  const key=prefix+value.id,old=await env.NOTES_KV.get(key,'json');
  if(old)return JSON.stringify(old)===JSON.stringify(value)?json(200,{saved:true,id:value.id}):json(409,{error:'Existe otra versión con ese identificador. No se ha sustituido.'});
  await env.NOTES_KV.put(key,JSON.stringify(value),{metadata:{createdAt:value.createdAt,count:value.count}});
  return json(201,{saved:true,id:value.id});
 }
 return json(405,{error:'Método no permitido; los archivos privados nunca se borran desde la web'});
}
