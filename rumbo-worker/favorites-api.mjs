// Sincronización privada de favoritos: el servidor almacena solo instantáneas AES-GCM.
// La ruta /favorites se autentica y filtra por Origin en worker.mjs.
const PREFIX='private-favorites/v1/owner/';
const json=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const idOk=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const b64=s=>typeof s==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(s);
const valid=item=>item&&typeof item==='object'&&!Array.isArray(item)&&
 Object.keys(item).sort().join(',')==='cipher,count,createdAt,id,iv,salt,version'&&
 item.version===1&&idOk(item.id)&&Number.isInteger(item.count)&&item.count>=0&&item.count<=2500&&
 typeof item.createdAt==='string'&&Number.isFinite(Date.parse(item.createdAt))&&
 b64(item.salt)&&item.salt.length===24&&b64(item.iv)&&item.iv.length===16&&
 b64(item.cipher)&&item.cipher.length>=24&&item.cipher.length<=500000;
export async function favoritesApi(request,env,path){
 if(!env.NOTES_KV)return json(503,{error:'Almacén privado no disponible; tus favoritos locales no se han cambiado.'});
 const suffix=path.slice('/favorites'.length),id=suffix.startsWith('/')?suffix.slice(1):'';
 if(suffix&&(!idOk(id)||suffix!=='/'+id))return json(404,{error:'Archivo no encontrado'});
 if(request.method==='GET'&&id){
   const item=await env.NOTES_KV.get(PREFIX+id,'json');
   return valid(item)?json(200,{snapshot:item}):json(404,{error:'Archivo no encontrado'});
 }
 if(request.method==='GET'&&!id){
   const cursor=new URL(request.url).searchParams.get('cursor')||undefined;
   if(cursor&&(cursor.length>1024||!/^[A-Za-z0-9_+/=-]+$/.test(cursor)))return json(400,{error:'Cursor inválido'});
   const page=await env.NOTES_KV.list({prefix:PREFIX,limit:100,...(cursor?{cursor}:{})});
   return json(200,{versions:page.keys.filter(x=>idOk(x.name.slice(PREFIX.length))).map(x=>({
     id:x.name.slice(PREFIX.length),count:Number.isInteger(x.metadata?.count)?x.metadata.count:null,
     createdAt:typeof x.metadata?.createdAt==='string'?x.metadata.createdAt:null
   })),cursor:page.list_complete?null:page.cursor});
 }
 if(request.method==='POST'&&!id){
   if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json(415,{error:'Se requiere JSON'});
   let item;
   try{
     const raw=await request.text();
     if(raw.length>510000)return json(413,{error:'Archivo demasiado grande'});
     item=JSON.parse(raw);
   }catch{return json(400,{error:'Archivo cifrado inválido'});}
   if(!valid(item))return json(400,{error:'Archivo cifrado inválido'});
   const name=PREFIX+item.id;
   const existing=await env.NOTES_KV.get(name,'json');
   if(existing)return JSON.stringify(existing)===JSON.stringify(item)?json(200,{saved:true,id:item.id}):json(409,{error:'Identificador ya utilizado; no se ha sobrescrito.'});
   await env.NOTES_KV.put(name,JSON.stringify(item),{metadata:{createdAt:item.createdAt,count:item.count}});
   return json(201,{saved:true,id:item.id});
 }
 return json(405,{error:'Método no permitido; las copias cifradas no se eliminan desde la aplicación'});
}
