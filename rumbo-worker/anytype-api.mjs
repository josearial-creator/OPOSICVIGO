// Private, single-space snapshot; no AI or logging.
const key='anytype:tasks:v1';
const states=new Set(['pendiente','hoy','en_curso','en_espera','completada','archivada','por_revisar']);
export async function anytypeApi(request,env,reply){
 if(!env.NOTES_KV)return reply(503,{error:'Almacenamiento no configurado'});
 if(request.method==='GET'){
  const saved=await env.NOTES_KV.get(key,'json');
  return reply(200,saved??{total:0,tareas:[],sincronizado_en:null});
 }
 if(request.method!=='POST')return reply(405,{error:'Método no permitido'});
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply(415,{error:'Se requiere JSON'});
 const reader=request.body?.getReader();if(!reader)return reply(400,{error:'Solicitud vacía'});
 let size=0, chunks=[];for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144){await reader.cancel();return reply(413,{error:'Solicitud demasiado grande'});}chunks.push(value);}
 let data;try{const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}data=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply(400,{error:'JSON inválido'});}
 if(data?.origen!=='anytype'||!Array.isArray(data.tareas)||data.total!==data.tareas.length||data.total<1||data.total>1000)return reply(400,{error:'Lote inválido'});
 const map=new Map();
 const date=v=>v==null?null:typeof v==='string'&&Number.isFinite(Date.parse(v))?v:undefined;
 for(const t of data.tareas){
  if(!t||typeof t.id!=='string'||!/^bafy[a-z2-7]{20,100}$/.test(t.id)||typeof t.titulo!=='string'||!t.titulo.trim()||t.titulo.length>2000||!states.has(t.estado)||map.has(t.id))return reply(400,{error:'Tarea inválida o duplicada'});
  const due=date(t.fecha_vencimiento),modified=date(t.fecha_modificacion);if(due===undefined||modified===undefined)return reply(400,{error:'Fecha inválida'});
  map.set(t.id,{id:t.id,titulo:t.titulo.trim().replace(/\bES(?:\s?\d){22}\b/gi,'[IBAN oculto]'),estado:t.estado,fecha_vencimiento:due,fecha_modificacion:modified,origen:'anytype',activa:['pendiente','hoy','en_curso','en_espera'].includes(t.estado)});
 }
 const previous=await env.NOTES_KV.get(key,'json');
 const merged=new Map((previous?.tareas??[]).map(t=>[t.id,t]));
 for(const [id,t] of map){const old=merged.get(id);if(!old?.fecha_modificacion||!t.fecha_modificacion||Date.parse(t.fecha_modificacion)>=Date.parse(old.fecha_modificacion))merged.set(id,t);}
 if(merged.size>2000)return reply(409,{error:'Límite de almacenamiento alcanzado'});
 const snapshot={origen:'anytype',sincronizado_en:new Date().toISOString(),total:merged.size,tareas:[...merged.values()]};
 await env.NOTES_KV.put(key,JSON.stringify(snapshot));
 return reply(200,{ok:true,total:snapshot.total,recibidas:map.size});
}
