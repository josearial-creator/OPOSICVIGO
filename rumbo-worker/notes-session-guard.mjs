// Guard de autorización para futura API del mismo origen.
// No está conectado a worker.mjs ni al diario real.
const encoder=new TextEncoder();
const toHex=a=>Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');
const secretCookie=(request)=>{
 const match=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-rumbo-session=([a-f0-9]{64})(?:;|$)/);
 return match?.[1]||null;
};
const equal=(a,b)=>{
 if(typeof a!=='string'||typeof b!=='string')return false;
 const x=encoder.encode(a),y=encoder.encode(b);
 let difference=x.length^y.length;
 for(let i=0;i<Math.max(x.length,y.length);i++)difference|=(x[i]||0)^(y[i]||0);
 return difference===0;
};
const deny=status=>new Response(JSON.stringify({error:status===401?'Acceso no autorizado':'Solicitud no permitida'}),{
 status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});
export function createNotesSessionGuard({store,apiOrigin,clock=()=>Date.now()}){
 if(!store||typeof store.get!=='function')throw Error('Almacén de sesiones no configurado');
 if(!apiOrigin||!apiOrigin.startsWith('https://')||new URL(apiOrigin).origin!==apiOrigin)throw Error('Origen API inválido');
 return async function authorize(request){
  const url=new URL(request.url),method=request.method;
  if(url.origin!==apiOrigin||url.protocol!=='https:')return deny(403);
  if(!['GET','POST','PUT','DELETE'].includes(method))return deny(405);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==apiOrigin)return deny(403);
  if(method!=='GET'&&origin!==apiOrigin)return deny(403);
  const cookie=secretCookie(request);if(!cookie)return deny(401);
  const hash=toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(cookie))));
  const record=await store.get(hash);
  if(!record||!Number.isSafeInteger(record.expiresAt)||record.expiresAt<=clock())return deny(401);
  if(method!=='GET'&&!equal(request.headers.get('X-Rumbo-CSRF'),record.csrf))return deny(403);
  return null; // null significa autorizado; el llamador decide ruta y operación.
 };
}
