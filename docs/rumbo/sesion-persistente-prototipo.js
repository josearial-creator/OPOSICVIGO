// Prototipo aislado del cliente same-origin, sin modificaciones de Mi espacio real.
// Nunca guarda contraseña, ID de sesión ni CSRF en almacenamiento persistente.
const BASE='/api/rumbo';
const allowed=/^\/notes(?:\/[a-f0-9-]{36})?$/;
export function createPersistentNotesClient({transport=fetch}={}){
 let csrf='',expiresAt=0;
 async function request(path,{method='GET',payload,csrfRequired=false}={}){
  const headers={'Accept':'application/json'};
  if(payload!==undefined)headers['Content-Type']='application/json';
  if(csrfRequired){
   if(!csrf)throw Error('Sesión sin CSRF. Verifica el acceso de nuevo.');
   headers['X-Rumbo-CSRF']=csrf;
  }
  const r=await transport(BASE+path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',headers,
   ...(payload!==undefined?{body:JSON.stringify(payload)}:{})});
  let result;try{result=await r.json();}catch{throw Error('Respuesta privada inválida');}
  if(!r.ok){
   if(r.status===401){csrf='';expiresAt=0;}
   throw Error(result.error||'Acceso privado no disponible');
  }
  return result;
 }
 const setSession=data=>{
  if(!data?.authenticated||typeof data.csrf!=='string'||data.csrf.length!==64||!Number.isFinite(data.expiresAt))throw Error('Respuesta de sesión inválida');
  csrf=data.csrf;expiresAt=data.expiresAt;
  return {authenticated:true,expiresAt};
 };
 return Object.freeze({
  async login(password){
   if(typeof password!=='string'||!password)throw Error('Contraseña requerida');
   const data=await request('/session/login',{method:'POST',payload:{password}});
   return setSession(data);
  },
  async resume(){
   try{return setSession(await request('/session'));}
   catch{csrf='';expiresAt=0;return {authenticated:false};}
  },
  async notes(path='',method='GET',payload){
   if(!allowed.test('/notes'+path))throw Error('Ruta privada inválida');
   if(!['GET','POST','PUT','DELETE'].includes(method))throw Error('Método privado inválido');
   return request('/notes'+path,{method,payload,csrfRequired:method!=='GET'});
  },
  async logout(){
   try{if(csrf)await request('/session/logout',{method:'POST',payload:{},csrfRequired:true});}
   finally{csrf='';expiresAt=0;}
  },
  get expiry(){return expiresAt;},
  // Los borradores AES-GCM siguen requiriendo la contraseña antigua para desbloquearse.
  get draftUnlocked(){return false;}
 });
}
