# Activación de Cloudflare desde GitHub · 2026-11-16

La activación de Mi espacio se solicita mediante el flujo existente de GitHub Actions, sin usar el inicio de sesión de Google.

La acción `activar-diario-20261114.yml` realiza pruebas antes de desplegar, consulta la configuración real, conserva el almacén D1 y bindings conocidos, crea `NOTES_KV` solo si no existe y valida una nota sintética con limpieza posterior.

Si las credenciales de Cloudflare faltan, están revocadas o carecen de permisos, la acción debe fallar. No almacenar nunca tokens en este documento o en el repositorio.

Este archivo es solo un registro de la solicitud de activación; no almacena notas privadas ni información de autenticación.

## Reintento tras configurar el token de Cloudflare

El propietario ha confirmado que sustituyó el token previamente expuesto y guardó un nuevo `CLOUDFLARE_API_TOKEN` en los secretos de GitHub Actions. Se solicita ejecutar el workflow existente sobre `main`; el job deberá bloquear el despliegue si las credenciales o las verificaciones no son válidas. No se guarda ningún valor de secreto en Git.
