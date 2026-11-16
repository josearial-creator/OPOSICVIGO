// Prototipo aislado: NO está conectado a worker.mjs ni a producción.
// Contrato del almacén: get/put/delete deben ofrecer lecturas coherentes tras revocación.
// NO utilizar Workers KV (consistencia eventual) para esta garantía.
const enc=new TextEncoder();
const hex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))));
const random=()=>{const a=crypto.getRandomValues(new Uint8Array(32));return [...a].map(b=>b.toString(16).padStart(2,'0')).join('');};
const eq=(a,b)=>{const x=enc.encode(a),y=enc.encode(b);let bad=x.length^y.length;const len=Math.max(x.length,y.length);for(let i=0;i<len;i++)bad|=(x[i]||0)^(y[i]||0);return bad===0;};
const json=(status,body,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const clearCookie='__Host-rumbo-session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
const cookie=(value,ageSeconds)=>`__Host-rumbo-session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${ageSeconds}`;
function parseCookie(request){const raw=request.headers.get('Cookie')||'';const match=raw.match(/(?:^|;\s*)__Host-rumbo-session=([a-f0-9]{64})(?:;|$)/);return match?.[1]||null;}
async function readSession(request,store,now){
 const id=parseCookie(request);if(!id)return null;
 const record=await store.get(await digest(id));
 if(!record||!Number.isFinite(record.expiresAt)||record.expiresAt<=now)return null;
 return {id,hash:await digest(id),record};
}
function checkOrigin(request,apiOrigin){
 const target=new URL(request.url);
 return target.protocol==='https:'&&target.origin===apiOrigin&&(request.method==='GET'?!request.headers.has('Origin')||request.headers.get('Origin')===apiOrigin:request.headers.get('Origin')===apiOrigin);
}
export function createSessionApi({store,secret,apiOrigin,clock=()=>Date.now(),maxAgeMs=30*24*60*60*1000,loginLimiter=null}){
 if(!store||!['get','put','delete'].every(n=>typeof store[n]==='function'))throw Error('Se requiere almacén coherente y revocable');
 if(!secret||secret.length<32)throw Error('Falta secreto de autenticación válido');
 if(!apiOrigin||new URL(apiOrigin).origin!==apiOrigin||!apiOrigin.startsWith('https://'))throw Error('Origen HTTPS explícito requerido');
 if(maxAgeMs<=0||maxAgeMs>2592000000)throw Error('Caducidad absoluta inválida');
 if(loginLimiter&&(!['clientId','check','recordFailure','recordSuccess'].every(n=>typeof loginLimiter[n]==='function')))throw Error('Limitador de acceso incompleto');
 return async function handle(request){
  if(!checkOrigin(request,apiOrigin))return json(403,{error:'Origen no autorizado'});
  const path=new URL(request.url).pathname;
  const method=request.method;
  if(path==='/session'&&method==='GET'){
   const session=await readSession(request,store,clock());
   return json(session?200:401,session?{authenticated:true,expiresAt:session.record.expiresAt,csrf:session.record.csrf}:{authenticated:false});
  }
  if(method!=='POST'||!['/session/login','/session/logout'].includes(path))return json(404,{error:'Ruta no disponible'});
  if(request.headers.get('Content-Type')!=='application/json')return json(415,{error:'Se requiere JSON'});
  if(path==='/session/login'){
   if(Number(request.headers.get('Content-Length')||0)>4096)return json(413,{error:'Solicitud demasiado grande'});
   let body;try{const raw=await request.text();if(raw.length>4096)throw Error();body=JSON.parse(raw);}catch{return json(400,{error:'Solicitud inválida'});}
   // En producción, el limitador DEBE utilizar un identificador de cliente fiable
   // proporcionado por una infraestructura que impida suplantación de cabeceras.
   // Sin dicha infraestructura no activar este prototipo.
   let clientId;
   if(loginLimiter){
    try{clientId=await loginLimiter.clientId(request);if(!clientId||!await loginLimiter.check(clientId))return json(429,{error:'Demasiados intentos. Prueba más tarde.'});}
    catch{return json(503,{error:'Control de acceso temporalmente no disponible'});}
   }
   if(typeof body?.password!=='string'||body.password.length>2048||!eq(body.password,secret)){
    if(loginLimiter){try{await loginLimiter.recordFailure(clientId);}catch{return json(503,{error:'Control de acceso temporalmente no disponible'});}}
    return json(401,{error:'Credenciales incorrectas'});
   }
   if(loginLimiter){try{await loginLimiter.recordSuccess(clientId);}catch{return json(503,{error:'Control de acceso temporalmente no disponible'});}}

   const prior=await readSession(request,store,clock());
   const id=random(),hash=await digest(id),expiresAt=clock()+maxAgeMs,csrf=random();
   await store.put(hash,{expiresAt,csrf});
   if(prior)await store.delete(prior.hash);
   // csrf permanece solo en memoria del frontend, NO en localStorage.
   return json(200,{authenticated:true,expiresAt,csrf},{'Set-Cookie':cookie(id,Math.ceil(maxAgeMs/1000))});
  }
  const session=await readSession(request,store,clock());
  if(!session)return json(401,{error:'Sesión no válida'},{'Set-Cookie':clearCookie});
  if(!eq(request.headers.get('X-Rumbo-CSRF')||'',session.record.csrf))return json(403,{error:'CSRF inválido'});
  await store.delete(session.hash);
  return json(200,{authenticated:false},{'Set-Cookie':clearCookie});
 };
}
