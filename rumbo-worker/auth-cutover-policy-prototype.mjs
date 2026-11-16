// Contrato aislado para un futuro cambio de autenticación en producción.
// Un cambio de contraseña solo revoca accesos si el Worker público NO mantiene
// una ruta de acceso por RUMBO_ACCESS_TOKEN al mismo recurso privado.
export function choosePrivateAuthMode({sessionFeatureEnabled,legacyNotesEnabled,sessionReady}){
 if(typeof sessionFeatureEnabled!=='boolean'||typeof legacyNotesEnabled!=='boolean'||typeof sessionReady!=='boolean')throw Error('Estado de seguridad incompleto');
 if(sessionFeatureEnabled){
  if(legacyNotesEnabled)throw Error('BLOQUEADO: no coexistir autenticación antigua y sesiones para el diario');
  if(!sessionReady)throw Error('BLOQUEADO: faltan comprobaciones de sesión segura');
  return Object.freeze({notes:'session',legacyNotes:'disabled'});
 }
 if(!legacyNotesEnabled)throw Error('BLOQUEADO: ninguna autenticación habilitada para el diario');
 return Object.freeze({notes:'legacy',legacyNotes:'enabled'});
}
export function enforcePrivateNotesBoundary(request,mode){
 if(!mode||!['legacy','session'].includes(mode.notes))throw Error('Modo no verificado');
 const path=new URL(request.url).pathname;
 if(path!=='/notes'&&!path.startsWith('/notes/'))return null;
 if(mode.notes==='session'){
  // No se permite caer a contraseña maestra de ningún tipo en el modo nuevo.
  if(request.headers.has('Authorization'))return new Response(JSON.stringify({error:'Autenticación antigua deshabilitada'}),{status:403,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 }
 return null;
}
