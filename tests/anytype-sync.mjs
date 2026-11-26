import assert from 'node:assert/strict';
import worker from '../rumbo-worker/worker.mjs';
const origin='https://example.test', sync='s'.repeat(40), access='a'.repeat(40);
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const sql=new DatabaseSync(':memory:');
sql.exec(readFileSync(new URL('../rumbo-worker/anytype-schema.sql',import.meta.url),'utf8'));
const db={
 prepare(query){return {all:async()=>({results:sql.prepare(query).all()}),bind(...args){return {run:()=>sql.prepare(query).run(...args)}}};},
 async batch(statements){sql.exec('BEGIN');try{for(const s of statements)s.run();sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}}
};
const env={ALLOWED_ORIGIN:origin,RUMBO_ACCESS_TOKEN:access,ANYTYPE_SYNC_TOKEN:sync,db};
const url='https://worker.test/anytype/tasks';
const task={id:'bafy'+'a'.repeat(50),titulo:'Tarea ficticia',estado:'pendiente',fecha_modificacion:'2026-11-26T09:00:00Z'};
const post=(token,t)=>worker.fetch(new Request(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({origen:'anytype',total:1,tareas:[t]})}),env);
const get=()=>worker.fetch(new Request(url,{headers:{Origin:origin,Authorization:'Bearer '+access}}),env);
assert.equal((await post(access,task)).status,401);
assert.equal((await post(sync,task)).status,200);
assert.equal((await post(sync,task)).status,200);
assert.equal((await (await get()).json()).total,1);
assert.equal((await post(sync,{...task,estado:'completada'})).status,200);
assert.equal((await (await get()).json()).tareas[0].activa,false);
assert.equal((await post(sync,{...task,titulo:''})).status,400);
assert.equal((await post(sync,{...task,estado:'por_revisar'})).status,200);
assert.equal((await (await get()).json()).tareas[0].activa,false);
assert.equal((await worker.fetch(new Request(url,{headers:{Origin:origin,Authorization:'Bearer '+sync}}),env)).status,401);
assert.equal((await post(sync,{...task,estado:'pendiente',fecha_modificacion:'2026-01-01T00:00:00Z'})).status,200);
assert.equal((await (await get()).json()).tareas[0].estado,'por_revisar');
const second={...task,id:'bafy'+'b'.repeat(50)};
await Promise.all([post(sync,second),post(sync,{...task,estado:'completada'})]);
assert.equal((await (await get()).json()).total,2);
console.log('Anytype synthetic smoke tests passed');
