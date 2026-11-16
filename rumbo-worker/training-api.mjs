// Registros de Entrenamiento cifrados en el navegador y separados de las notas.
const prefix='private-training/v1/owner/';
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const idOk=x=>typeof x==='string'&&/^[a-f0-9-]{36}$/.test(x);
const b64=x=>typeof x==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(x);
const iso=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)&&!Number.isNaN(Date.parse(x));
const valid=x=>x&&x.version===1&&idOk(x.id)&&iso(x.date)&&b64(x.salt)&&x.salt.length===24&&b64(x.iv)&&x.iv.length===16&&b64(x.cipher)&&x.cipher.length>=24&&x.cipher.length<=24000;
export async function trainingApi(request,env,path){
 if(!env.NOTES_KV)return json(503,{error:'Almacenamiento privado no configurado'});
 const suffix=path.slice('/training'.length);
 const id=suffix.startsWith('/')?suffix.slice(1):'';
 if(suffix&&(!idOk(id)||suffix!=='/'+id))return json(404,{error:'Recurso no disponible'});
 if(request.method==='GET'&&!id){
  const rows=[];let cursor;
  do{
   const page=await env.NOTES_KV.list({prefix,limit:100,cursor});
   for(const entry of page.keys){const item=await env.NOTES_KV.get(entry.name,'json');if(valid(item))rows.push(item);}
   cursor=page.list_complete?undefined:page.cursor;
  }while(cursor&&rows.length<1000);
  rows.sort((a,b)=>b.date.localeCompare(a.date));
  return json(200,{records:rows.slice(0,1000)});
 }
 if(request.method==='POST'&&!id){
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json(415,{error:'Se requiere JSON'});
  let value;try{const raw=await request.text();if(raw.length>26000)return json(413,{error:'Registro demasiado grande'});value=JSON.parse(raw);}catch{return json(400,{error:'Registro no válido'});}
  if(!valid(value))return json(400,{error:'Registro cifrado no válido'});
  const k=prefix+value.id;
  const previous=await env.NOTES_KV.get(k,'json');
  if(previous)return JSON.stringify(previous)===JSON.stringify(value)?json(200,{record:previous}):json(409,{error:'Ya existe un registro con ese identificador'});
  await env.NOTES_KV.put(k,JSON.stringify({version:1,id:value.id,date:value.date,salt:value.salt,iv:value.iv,cipher:value.cipher}));
  return json(201,{record:value});
 }
 if(request.method==='DELETE'&&id){
  if(!await env.NOTES_KV.get(prefix+id))return json(404,{error:'Registro no encontrado'});
  await env.NOTES_KV.delete(prefix+id);
  return json(200,{deleted:true});
 }
 return json(405,{error:'Método no permitido'});
}
