// Adaptador D1 para el prototipo aislado. NO referenciado desde worker.mjs.
// Cada consulta inicia una sesión D1 con primera lectura en primario: así
// una revocación previa no puede quedar oculta tras una réplica atrasada.
// Sin withSession, el binding D1 directo dirige las consultas al primario.
// Referencia: Cloudflare D1 withSession('first-primary').
const HASH=/^[a-f0-9]{64}$/;
export function createD1SessionStore(db,{clock=()=>Date.now()}={}){
 if(!db||typeof db.prepare!=='function')throw Error('Binding D1 ausente');
 const stmt=(sql,...args)=>{
   const primary=typeof db.withSession==='function'?db.withSession('first-primary'):db;
   return primary.prepare(sql).bind(...args);
 };
 const validate=hash=>{if(typeof hash!=='string'||!HASH.test(hash))throw Error('Identificador inválido');};
 return Object.freeze({
  async get(hash){
   validate(hash);
   const row=await stmt('SELECT csrf_token,expires_at,auth_version FROM rumbo_auth_sessions_v1 WHERE token_hash=?',hash).first();
   if(!row)return null;
   if(!Number.isSafeInteger(row.expires_at)||row.expires_at<=clock())return null;
   return {csrf:row.csrf_token,expiresAt:row.expires_at,...(row.auth_version!==undefined?{authVersion:row.auth_version}:{})};
  },
  async put(hash,record){
   validate(hash);
   if(!record||typeof record.csrf!=='string'||!HASH.test(record.csrf)||!Number.isSafeInteger(record.expiresAt)||record.expiresAt<=clock()||record.expiresAt>clock()+2592000000)throw Error('Sesión inválida');
   if(record.authVersion!==undefined&&(!Number.isSafeInteger(record.authVersion)||record.authVersion<1))throw Error('Versión de autenticación inválida');
   await stmt('INSERT INTO rumbo_auth_sessions_v1 (token_hash,csrf_token,expires_at,created_at,auth_version) VALUES (?,?,?,?,?)',hash,record.csrf,record.expiresAt,clock(),record.authVersion??1).run();
  },
  async delete(hash){
   validate(hash);
   await stmt('DELETE FROM rumbo_auth_sessions_v1 WHERE token_hash=?',hash).run();
  },
  async purgeExpired(){
   return stmt('DELETE FROM rumbo_auth_sessions_v1 WHERE expires_at<=?',clock()).run();
  }
 });
}
