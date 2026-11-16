// PROTOTIPO AISLADO: no se conecta a Vercel ni a Cloudflare en producción.
// Borde de confianza entre la ruta pública /api/rumbo/* y el Worker.
// No sustituye a la autenticación propia del usuario ni al control de intentos.
const te=new TextEncoder();
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;
 const x=te.encode(a),y=te.encode(b);let bad=x.length^y.length;
 for(let i=0;i<Math.max(x.length,y.length);i++)bad|=(x[i]||0)^(y[i]||0);
 return bad===0;
}
const fail=(status,error)=>new Response(JSON.stringify({error}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const prefix='/api/rumbo';
const endpoint='/internal/rumbo';
const paths=/^\/(?:session(?:\/login|\/logout)?|password\/change|notes(?:\/[a-f0-9-]{36})?)$/;
function validConfig({publicOrigin,workerOrigin,serviceSecret}){
 const okOrigin=x=>{try{return typeof x==='string'&&x.startsWith('https://')&&new URL(x).origin===x;}catch{return false;}};
 if(!okOrigin(publicOrigin)||!okOrigin(workerOrigin)||publicOrigin===workerOrigin||typeof serviceSecret!=='string'||serviceSecret.length<32)throw Error('Frontera interna mal configurada');
}
function routePath(path,base){
 if(!path.startsWith(base+'/'))return null;
 const suffix=path.slice(base.length);
 return paths.test(suffix)?suffix:null;
}
function forwardedHeaders(req){
 const h=new Headers();
 const type=req.headers.get('Content-Type');if(type)h.set('Content-Type',type);
 const csrf=req.headers.get('X-Rumbo-CSRF');if(csrf)h.set('X-Rumbo-CSRF',csrf);
 const origin=req.headers.get('Origin');if(origin)h.set('Origin',origin);
 const cookie=req.headers.get('Cookie')||'';
 const m=cookie.match(/(?:^|;\s*)(__Host-rumbo-session=[a-f0-9]{64})(?:;|$)/);
 if(m)h.set('Cookie',m[1]);
 return h;
}
function browserResponse(remote){
 const h=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Type':'application/json'});
 const cookie=remote.headers.get('Set-Cookie');
 // Only the one dedicated, tightly-scoped session cookie may be forwarded.
 if(cookie&&/^__Host-rumbo-session=(?:[a-f0-9]{64}|); HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=\d+$/.test(cookie))h.set('Set-Cookie',cookie);
 return new Response(remote.body,{status:remote.status,headers:h});
}
export function createFirstPartyProxy({publicOrigin,workerOrigin,serviceSecret,transport=fetch}){
 validConfig({publicOrigin,workerOrigin,serviceSecret});
 return async request=>{
  const url=new URL(request.url),path=routePath(url.pathname,prefix),method=request.method;
  if(url.origin!==publicOrigin||!path||url.search||!['GET','POST','PUT','DELETE'].includes(method))return fail(404,'Ruta no disponible');
  if(method!=='GET'&&request.headers.get('Origin')!==publicOrigin)return fail(403,'Origen no permitido');
  if(request.headers.has('Origin')&&request.headers.get('Origin')!==publicOrigin)return fail(403,'Origen no permitido');
  if(Number(request.headers.get('Content-Length')||0)>20000)return fail(413,'Solicitud demasiado grande');
  const headers=forwardedHeaders(request);
  headers.set('X-Rumbo-Service-Auth',serviceSecret);
  let body;
  if(method!=='GET'){
   body=await request.arrayBuffer();
   if(body.byteLength>20000)return fail(413,'Solicitud demasiado grande');
  }
  try{
   const remote=await transport(new Request(workerOrigin+endpoint+path,{method,headers,body,redirect:'manual',cache:'no-store'}));
   if(remote.status>=300&&remote.status<400)return fail(502,'El servidor privado no puede redirigir');
   return browserResponse(remote);
  }catch{return fail(503,'Servicio privado no disponible');}
 };
}
export function createInternalWorkerBridge({publicOrigin,workerOrigin,serviceSecret,gateway}){
 validConfig({publicOrigin,workerOrigin,serviceSecret});
 if(typeof gateway!=='function')throw Error('Falta puerta privada');
 return async request=>{
  const url=new URL(request.url),path=routePath(url.pathname,endpoint);
  if(url.origin!==workerOrigin||!path||url.search)return fail(404,'Ruta no disponible');
  if(!equal(request.headers.get('X-Rumbo-Service-Auth'),serviceSecret))return fail(403,'Acceso interno denegado');
  // Se confía únicamente en el servicio proxy; nunca en Host o Forwarded del cliente.
  const headers=forwardedHeaders(request);
  const method=request.method;
  return gateway(new Request(publicOrigin+path,{method,headers,body:method==='GET'||method==='HEAD'?undefined:request.body,duplex:method==='GET'?undefined:'half'}));
 };
}
