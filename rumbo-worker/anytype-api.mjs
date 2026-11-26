// Private, single-space snapshot; no AI or logging.

const states=new Set(['pendiente','hoy','en_curso','en_espera','completada','archivada','por_revisar']);
export async function anytypeApi(request,env,reply){
 if(!env.db)return reply(503,{error:'Almacenamiento no configurado'});
 if(request.method==='GET'){
  const rows=await env.db.prepare('SELECT payload, synced_at FROM anytype_tasks ORDER BY id LIMIT 2001').all();
  if(rows.results.length>2000)return reply(503,{error:'Límite de consulta alcanzado'});
  const tareas=rows.results.map(r=>JSON.parse(r.payload));
  const sincronizado_en=rows.results.reduce((a,r)=>!a||r.synced_at>a?r.synced_at:a,null);
  return reply(200,{total:tareas.length,tareas,sincronizado_en});
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
 const now=new Date().toISOString();
 const statements=[...map.values()].map(t=>env.db.prepare(
  'INSERT INTO anytype_tasks (id,payload,modified_at,synced_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,modified_at=excluded.modified_at,synced_at=excluded.synced_at WHERE anytype_tasks.modified_at IS NULL OR (excluded.modified_at IS NOT NULL AND excluded.modified_at>=anytype_tasks.modified_at)'
 ).bind(t.id,JSON.stringify(t),t.fecha_modificacion?new Date(t.fecha_modificacion).toISOString():null,now));
 await env.db.batch(statements);
 return reply(200,{ok:true,recibidas:map.size});
}
