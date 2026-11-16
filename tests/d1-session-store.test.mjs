import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createD1SessionStore} from '../rumbo-worker/d1-session-store.mjs';
import {createSessionApi} from '../rumbo-worker/session-prototype.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const h='a'.repeat(64),csrf='b'.repeat(64),now=Date.UTC(2026,10,16);
function database(){
 const rows=new Map(),statements=[];
 return {rows,statements,prepare(sql){
  return {bind(...args){statements.push({sql,args});return {
    async first(){if(!sql.startsWith('SELECT '))throw Error('SELECT esperado');const row=rows.get(args[0]);return row?{csrf_token:row.csrf,expires_at:row.expiresAt}:null;},
    async run(){
     if(sql.startsWith('INSERT ')){if(rows.has(args[0]))throw Error('Conflicto de ID');rows.set(args[0],{csrf:args[1],expiresAt:args[2]});}
     else if(sql.startsWith('DELETE ')&&sql.includes('token_hash'))rows.delete(args[0]);
     else if(sql.startsWith('DELETE ')){for(const [id,row] of rows)if(row.expiresAt<=args[0])rows.delete(id);}
     else throw Error('SQL inesperado');
     return {success:true};
    }
   };}};
 }};
}
test('D1: guarda solo hash y CSRF, revoca y expira',async()=>{
 const db=database(),store=createD1SessionStore(db,{clock:()=>now});
 await store.put(h,{csrf,expiresAt:now+1000});
 assert.deepEqual(await store.get(h),{csrf,expiresAt:now+1000});
 await store.delete(h);assert.equal(await store.get(h),null);
 await store.put(h,{csrf,expiresAt:now+1000});
 const late=createD1SessionStore(db,{clock:()=>now+1001});
 assert.equal(await late.get(h),null);
 await late.purgeExpired();assert.equal(db.rows.size,0);
 assert.equal(db.statements.some(s=>s.sql.includes('?')&&s.args[0]===h),true);
});
test('D1: rechazo de hash o credenciales inválidas; sin tabla falla cerrado',async()=>{
 const store=createD1SessionStore(database(),{clock:()=>now});
 await assert.rejects(()=>store.get('invalido'));
 await assert.rejects(()=>store.put(h,{csrf:'invalido',expiresAt:now+1000}));
 const missing={prepare(){return{bind(){return{first:async()=>{throw Error('no such table');}};}};}};
 await assert.rejects(()=>createD1SessionStore(missing).get(h),/no such table/);
});
test('Prototipo + D1: login, comprobación y revocación; sin alterar anotaciones',async()=>{
 const db=database(),store=createD1SessionStore(db,{clock:()=>now});
 const origin='https://rumbo.test',secret='test-secret-only-012345678901234567890';
 const api=createSessionApi({store,secret,apiOrigin:origin,clock:()=>now});
 const req=(path,method='GET',cookie='',token='')=>new Request(origin+path,{method,headers:{...(method==='POST'?{Origin:origin,'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(token?{'X-Rumbo-CSRF':token}:{})},...(method==='POST'?{body:JSON.stringify(path.endsWith('login')?{password:secret}:{})}:{})});
 const login=await api(req('/session/login','POST'));assert.equal(login.status,200);
 const cookie=login.headers.get('Set-Cookie').split(';')[0],data=await login.json();
 const resumed=await (await api(req('/session','GET',cookie))).json();
 assert.equal(resumed.authenticated,true);
 assert.equal(resumed.csrf,data.csrf,'Al reabrir en el mismo origen se recupera protección CSRF');
 assert.equal((await api(req('/session/logout','POST',cookie,data.csrf))).status,200);
 assert.equal((await api(req('/session','GET',cookie))).status,401);
 assert.equal(db.rows.size,0);
});

test('D1: usa primario en cada consulta, incluso tras revocación en otra petición',async()=>{
 const db=database(),hints=[];
 db.withSession=hint=>{hints.push(hint);return {prepare:db.prepare.bind(db)};};
 const store=createD1SessionStore(db,{clock:()=>now});
 await store.put(h,{csrf,expiresAt:now+10000});
 assert.ok(await store.get(h));
 await store.delete(h);
 assert.equal(await store.get(h),null);
 assert.deepEqual(hints,['first-primary','first-primary','first-primary','first-primary']);
});
