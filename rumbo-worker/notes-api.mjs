// Backend privado para Mi espacio. Requiere autenticación previa en worker.mjs.
// Cada nota usa una clave propia para evitar sobrescribir notas concurrentes.
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const prefix='private-notes/v1/owner/';
const idOk=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
const validText=t=>typeof t==='string'&&t.trim().length>0&&t.length<=10000;
export async function notesApi(request,env,path) {
 if(!env.NOTES_KV)return reply(503,{error:'Almacenamiento privado no configurado. No se ha guardado nada.'});
 const suffix=path.slice('/notes'.length);
 const id=suffix.startsWith('/')?suffix.slice(1):'';
 if(suffix&&(!idOk(id)||suffix!==('/'+id)))return reply(404,{error:'Recurso no disponible'});
 const method=request.method;
 if(method==='GET'&&!id){
   const rows=[];let cursor;
   do {
     const batch=await env.NOTES_KV.list({prefix,limit:100,cursor});
     for(const key of batch.keys){
       const value=await env.NOTES_KV.get(key.name,'json');
       if(value&&validText(value.text))rows.push(value);
     }
     cursor=batch.list_complete?undefined:batch.cursor;
   }while(cursor&&rows.length<1000);
   rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
   return reply(200,{notes:rows.slice(0,1000)});
 }
 if(method==='GET'&&id){
   const note=await env.NOTES_KV.get(prefix+id,'json');
   return note?reply(200,{note}):reply(404,{error:'Anotación no encontrada'});
 }
 if(method==='DELETE'&&id){
   if(!await env.NOTES_KV.get(prefix+id))return reply(404,{error:'Anotación no encontrada'});
   await env.NOTES_KV.delete(prefix+id);
   return reply(200,{deleted:true});
 }
 if(method==='DELETE'&&!id){
   let cursor;
   do {
     const batch=await env.NOTES_KV.list({prefix,limit:100,cursor});
     await Promise.all(batch.keys.map(x=>env.NOTES_KV.delete(x.name)));
     cursor=batch.list_complete?undefined:batch.cursor;
   }while(cursor);
   return reply(200,{deleted:true});
 }
 if((method==='POST'&&!id)||(method==='PUT'&&id)){
   if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply(415,{error:'Se requiere JSON'});
   let data;
   try{const raw=await request.text();if(raw.length>12000)return reply(413,{error:'Texto demasiado largo'});data=JSON.parse(raw);}
   catch{return reply(400,{error:'Contenido no válido'});}
   if(!validText(data?.text))return reply(400,{error:'Escribe una anotación (máximo 10.000 caracteres)'});
   if(data.mood!==null&&data.mood!==undefined&&(!['bien','regular','mal'].includes(data.mood)))return reply(400,{error:'Estado de ánimo no válido'});
   if(method==='POST'&&data.createId!==undefined&&!idOk(data.createId))return reply(400,{error:'Identificador de guardado no válido'});
   if(method==='POST'&&data.createId){
     const existing=await env.NOTES_KV.get(prefix+data.createId,'json');
     if(existing){
       if(existing.text!==data.text||(existing.mood??null)!==(data.mood??null))return reply(409,{error:'Este guardado ya existe con otro contenido. Conserva el borrador y abre la nota guardada antes de editarla.'});
       return reply(200,{note:existing});
     }
   }
   const now=new Date().toISOString();
   let note;
   if(method==='PUT'){
      note=await env.NOTES_KV.get(prefix+id,'json');
      if(!note)return reply(404,{error:'Anotación no encontrada'});
      note={...note,text:data.text,mood:data.mood??null,updatedAt:now};
   } else {
      note={id:data.createId||crypto.randomUUID(),text:data.text,mood:data.mood??null,createdAt:now,updatedAt:now};
   }
   await env.NOTES_KV.put(prefix+note.id,JSON.stringify(note));
   return reply(method==='POST'?201:200,{note});
 }
 return reply(405,{error:'Método no disponible'});
}
