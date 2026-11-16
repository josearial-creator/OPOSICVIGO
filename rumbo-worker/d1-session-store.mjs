// Adaptador D1 para el prototipo aislado. NO referenciado desde worker.mjs.
// REQUISITO antes de producción: read_replication.mode='disabled' o un diseño
// de consistencia y bookmarks verificado en peticiones independientes.
const HASH=/^[a-f0-9]{64}$/;
export function createD1SessionStore(db,{clock=()=>Date.now()}={}){
 if(!db||typeof db.prepare!=='function')throw Error('Binding D1 ausente');
 const stmt=(sql,...args)=>db.prepare(sql).bind(...args);
 const validate=hash=>{if(typeof hash!=='string'||!HASH.test(hash))throw Error('Identificador inválido');};
 return Object.freeze({
  async get(hash){
   validate(hash);
   const row=await stmt('SELECT csrf_token,expires_at FROM rumbo_auth_sessions_v1 WHERE token_hash=?',hash).first();
   if(!row)return null;
   if(!Number.isSafeInteger(row.expires_at)||row.expires_at<=clock())return null;
   return {csrf:row.csrf_token,expiresAt:row.expires_at};
  },
  async put(hash,record){
   validate(hash);
   if(!record||typeof record.csrf!=='string'||!HASH.test(record.csrf)||!Number.isSafeInteger(record.expiresAt)||record.expiresAt<=clock()||record.expiresAt>clock()+2592000000)throw Error('Sesión inválida');
   await stmt('INSERT INTO rumbo_auth_sessions_v1 (token_hash,csrf_token,expires_at,created_at) VALUES (?,?,?,?)',hash,record.csrf,record.expiresAt,clock()).run();
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
