-- Migración futura e independiente para contraseña personal (NO ejecutar en producción).
-- La contraseña no caduca. La sesión del navegador sí caduca a los 30 días.
-- El registro identifica una única cuenta privada de Rumbo, sin guardar secretos en claro.
CREATE TABLE IF NOT EXISTS rumbo_private_password_v1 (
  account_id TEXT PRIMARY KEY NOT NULL CHECK (account_id='owner'),
  kdf TEXT NOT NULL CHECK (kdf='PBKDF2-SHA256'),
  iterations INTEGER NOT NULL CHECK (iterations >= 600000),
  salt_hex TEXT NOT NULL CHECK (length(salt_hex)=32),
  verifier_hex TEXT NOT NULL CHECK (length(verifier_hex)=64),
  changed_at INTEGER NOT NULL,
  auth_version INTEGER NOT NULL DEFAULT 1
);
-- Una migración real debe verificarse contra la contraseña antigua antes de habilitar login.
-- No alterar RUMBO_ACCESS_TOKEN ni borradores hasta completar un flujo de recuperación probado.
