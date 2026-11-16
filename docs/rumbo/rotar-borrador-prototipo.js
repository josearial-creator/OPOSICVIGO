// Prototipo independiente. NO está cargado en Mi espacio ni en producción.
// Re-cifra borradores V1/V2 sin escribir en localStorage hasta verificar resultado.
// Compatible con PBKDF2 180000 + AES-GCM del diario actual.
const enc=new TextEncoder(),dec=new TextDecoder();
const from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const to64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const makeKey=async(pass,salt)=>{
 const base=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:180000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
};
export async function prepareDraftPasswordRotation({saved,oldPassword,newPassword}){
 if(typeof oldPassword!=='string'||!oldPassword||typeof newPassword!=='string'||newPassword.length<12)throw Error('Contraseñas inválidas');
 if(typeof saved!=='string'||saved.length>100000)throw Error('Borrador inválido');
 let source;try{source=JSON.parse(saved);}catch{throw Error('Borrador no válido');}
 if(!source||![undefined,2].includes(source.format)||!['salt','iv','cipher'].every(k=>typeof source[k]==='string'))throw Error('Formato de borrador no reconocido');
 const initialSalt=from64(source.salt),initialIv=from64(source.iv);
 if(initialSalt.length!==16||initialIv.length!==12)throw Error('Parámetros del borrador inválidos');
 // Jamás escribir ni borrar el registro anterior cuando el antiguo password falla.
 let clear;try{
  clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:initialIv},await makeKey(oldPassword,initialSalt),from64(source.cipher));
 }catch{throw Error('No se pudo abrir el borrador con la contraseña actual');}
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const nextKey=await makeKey(newPassword,salt);
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},nextKey,clear);
 const validated=await crypto.subtle.decrypt({name:'AES-GCM',iv},nextKey,cipher);
 const a=new Uint8Array(clear),b=new Uint8Array(validated);
 if(a.length!==b.length||a.some((x,i)=>x!==b[i]))throw Error('No se ha podido verificar el nuevo cifrado');
 return {newSaved:JSON.stringify({format:2,salt:to64(salt),iv:to64(iv),cipher:to64(cipher)}),plaintextWasVerified:true};
}
