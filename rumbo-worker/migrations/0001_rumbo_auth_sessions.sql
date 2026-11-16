-- Solo preparar en una base de datos de pruebas. No ejecutar automáticamente en producción.
-- Tabla aislada: no modifica las tablas existentes ni el almacén NOTES_KV.
CREATE TABLE IF NOT EXISTS rumbo_auth_sessions_v1 (
  token_hash TEXT PRIMARY KEY NOT NULL CHECK (length(token_hash)=64),
  csrf_token TEXT NOT NULL CHECK (length(csrf_token)=64),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rumbo_auth_sessions_expiry_v1
  ON rumbo_auth_sessions_v1 (expires_at);
