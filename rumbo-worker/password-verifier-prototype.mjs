// Prototipo aislado: verificación de contraseña elegida por el propietario.
// No se importa desde worker.mjs; no cambia RUMBO_ACCESS_TOKEN.
const encoder=new TextEncoder();
const rounds=600000;
const toHex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const fromHex=hex=>Uint8Array.from(hex.match(/.{2}/g),x=>parseInt(x,16));
const hex32=/^[a-f0-9]{64}$/,salt16=/^[a-f0-9]{32}$/;
function safeEquals(a,b){
 const x=new Uint8Array(a),y=new Uint8Array(b);let diff=x.length^y.length;
 for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);
 return diff===0;
}
async function derive(pass,salt,count){
 const key=await crypto.subtle.importKey('raw',encoder.encode(pass),'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:count,hash:'SHA-256'},key,256));
}
export function passwordPolicy(password){
 return typeof password==='string'&&password.length>=12&&password.length<=256
   &&encoder.encode(password).length<=1024&&!/^\s+$/.test(password);
}
export async function preparePasswordVerifier(password,{clock=()=>Date.now()}={}){
 if(!passwordPolicy(password))throw Error('La contraseña nueva no cumple los requisitos');
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const derived=await derive(password,salt,rounds);
 return {kdf:'PBKDF2-SHA256',iterations:rounds,salt_hex:toHex(salt),
  verifier_hex:toHex(derived),changed_at:clock()};
}
export async function verifyPasswordVerifier(password,record){
 if(typeof password!=='string'||password.length>256||encoder.encode(password).length>1024)return false;
 if(!record||record.kdf!=='PBKDF2-SHA256'||!Number.isSafeInteger(record.iterations)
   ||record.iterations<rounds||record.iterations>1200000
   ||typeof record.salt_hex!=='string'||!salt16.test(record.salt_hex)
   ||typeof record.verifier_hex!=='string'||!hex32.test(record.verifier_hex))return false;
 const candidate=await derive(password,fromHex(record.salt_hex),record.iterations);
 return safeEquals(candidate,fromHex(record.verifier_hex));
}
export async function preparePasswordChange({currentPassword,newPassword,confirmation,storedVerifier}){
 if(newPassword!==confirmation)throw Error('La contraseña nueva no coincide con su confirmación');
 if(!passwordPolicy(newPassword)||newPassword===currentPassword)throw Error('Elige una contraseña nueva válida y diferente');
 if(!await verifyPasswordVerifier(currentPassword,storedVerifier))throw Error('La contraseña actual es incorrecta');
 return preparePasswordVerifier(newPassword);
}
