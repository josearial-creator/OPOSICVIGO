// Router aislado de sesiones + notas. No se importa desde worker.mjs.
// La futura ruta /api/rumbo debe servirse en el MISMO origen que el frontend.
import {createSessionApi} from './session-prototype.mjs';
import {createNotesSessionGuard} from './notes-session-guard.mjs';
import {createD1SessionStore} from './d1-session-store.mjs';
import {notesApi} from './notes-api.mjs';
const reply=(status,message)=>new Response(JSON.stringify({error:message}),{status,headers:{
 'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
}});
export function createPrivateGateway({db,notesEnv,secret,apiOrigin,clock=()=>Date.now(),notesHandler=notesApi}){
 if(!db||!notesEnv||!secret||!apiOrigin)throw Error('Configuración incompleta');
 const store=createD1SessionStore(db,{clock});
 const sessions=createSessionApi({store,secret,apiOrigin,clock});
 const authorize=createNotesSessionGuard({store,apiOrigin,clock});
 return async function route(request){
  const url=new URL(request.url);
  if(url.origin!==apiOrigin)return reply(403,'Origen no permitido');
  const path=url.pathname;
  if(path==='/session'||path==='/session/login'||path==='/session/logout')return sessions(request);
  if(path==='/notes'||path.startsWith('/notes/')){
   try{
    const denied=await authorize(request);
    if(denied)return denied;
    // La API actual conserva validaciones, operaciones y claves privadas.
    return await notesHandler(request,notesEnv,path);
   }catch{return reply(503,'Servicio privado no disponible');}
  }
  return reply(404,'Ruta no disponible');
 };
}
