// Almacén aislado de contraseña personal. No conectado a producción.
// Compare-and-swap de credenciales: evita dos cambios simultáneos.
// Las sesiones se invalidan por auth_version, revisada en CADA petición.
const validHex=(s,n)=>typeof s==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(s);
export function createOwnerPasswordStore(db){
 if(!db||typeof db.prepare!=='function')throw Error('D1 no disponible');
 const primary=()=>typeof db.withSession==='function'?db.withSession('first-primary'):db;
 return Object.freeze({
  async current(){
   const row=await primary().prepare("SELECT account_id,kdf,iterations,salt_hex,verifier_hex,changed_at,auth_version FROM rumbo_private_password_v1 WHERE account_id='owner'").first();
   if(!row)return null;
   if(!Number.isSafeInteger(row.auth_version)||row.auth_version<1)throw Error('Versión de contraseña no válida');
   return row;
  },
  async compareAndSwap(expected,prepared){
   if(!expected||expected.account_id!=='owner'||!Number.isSafeInteger(expected.auth_version)||expected.auth_version<1
    ||!validHex(expected.verifier_hex,64))throw Error('Estado previo de credenciales inválido');
   if(!prepared||prepared.kdf!=='PBKDF2-SHA256'||!Number.isSafeInteger(prepared.iterations)||prepared.iterations<600000
    ||!validHex(prepared.salt_hex,32)||!validHex(prepared.verifier_hex,64)
    ||!Number.isSafeInteger(prepared.changed_at))throw Error('Credenciales nuevas inválidas');
   const result=await primary().prepare(
    "UPDATE rumbo_private_password_v1 SET kdf=?,iterations=?,salt_hex=?,verifier_hex=?,changed_at=?,auth_version=auth_version+1 WHERE account_id='owner' AND auth_version=? AND verifier_hex=?"
   ).bind(prepared.kdf,prepared.iterations,prepared.salt_hex,prepared.verifier_hex,prepared.changed_at,expected.auth_version,expected.verifier_hex).run();
   // D1 changes counts must be checked: a stale or repeated change may never report success.
   if(!result?.success||result?.meta?.changes!==1)throw Error('Cambio de contraseña no confirmado; estado original conservado');
   return expected.auth_version+1;
  }
 });
}
