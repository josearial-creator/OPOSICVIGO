// Endpoint aislado: NO conectado al Worker real.
// Solo acepta cambio de contraseña con sesión vigente, Origin y CSRF válidos.
// Se requiere un mecanismo de bloqueo de intentos fiable ANTES de producción.
import {preparePasswordChange} from './password-verifier-prototype.mjs';
import {createOwnerPasswordStore} from './owner-password-store-prototype.mjs';
const MAX_LENGTH=3072;
const reply=(status,error,headers={})=>new Response(JSON.stringify({error}),{status,headers:{
 'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers
}});
const clearCookie='__Host-rumbo-session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
export function createPasswordChangeHandler({db,authorize,limiter=null}){
 if(!db||typeof authorize!=='function')throw Error('Cambio sin autenticación configurada');
 if(limiter!==null&&!['clientId','check','recordFailure','recordSuccess'].every(k=>typeof limiter[k]==='function'))throw Error('Protección de intentos incompleta');
 const store=createOwnerPasswordStore(db);
 return async function passwordChange(request){
  if(new URL(request.url).pathname!=='/password/change'||request.method!=='POST')return reply(404,'Ruta no disponible');
  if(request.headers.get('Content-Type')!=='application/json')return reply(415,'Se requiere JSON');
  try{
   const rejected=await authorize(request);
   if(rejected)return rejected;
   // El limitador debe estar presente al activar la ruta. Se simula solo en pruebas.
   if(!limiter)return reply(503,'Protección de contraseña aún no activada');
   let id;
   try{id=await limiter.clientId(request);if(!id||!await limiter.check(id))return reply(429,'Demasiados intentos');}
   catch{return reply(503,'Protección de contraseña no disponible');}
   let data;
   try{
    const raw=await request.text();
    if(raw.length>MAX_LENGTH)return reply(413,'Solicitud demasiado grande');
    data=JSON.parse(raw);
   }catch{return reply(400,'Solicitud inválida');}
   const previous=await store.current();
   if(!previous)return reply(503,'Contraseña personal no inicializada');
   let prepared;
   try{
    prepared=await preparePasswordChange({
     currentPassword:data?.currentPassword,newPassword:data?.newPassword,
     confirmation:data?.confirmation,storedVerifier:previous
    });
   }catch(e){
    try{await limiter.recordFailure(id);}catch{return reply(503,'Protección de contraseña no disponible');}
    // No distinguir si falló contraseña antigua o política en respuesta remota.
    return reply(400,'No se pudo validar el cambio de contraseña');
   }
   // La base de datos hace CAS; otros dispositivos se invalidan por auth_version.
   // El navegador debe preparar y respaldar su borrador ANTES de llamar aquí.
   try{await store.compareAndSwap(previous,prepared);}
   catch{return reply(409,'El cambio no se ha confirmado; no se ha modificado tu borrador');}
   try{await limiter.recordSuccess(id);}catch{/* No restaurar credencial anterior tras una escritura confirmada */}
   return new Response(JSON.stringify({changed:true,reloginRequired:true}),{status:200,headers:{
    'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    'Set-Cookie':clearCookie
   }});
  }catch{return reply(503,'Servicio de contraseña no disponible');}
 };
}
