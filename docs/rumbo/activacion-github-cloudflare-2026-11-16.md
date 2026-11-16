# Activación de Cloudflare desde GitHub · 2026-11-16

La activación de Mi espacio se solicita mediante el flujo existente de GitHub Actions, sin usar el inicio de sesión de Google.

La acción `activar-diario-20261114.yml` realiza pruebas antes de desplegar, consulta la configuración real, conserva el almacén D1 y bindings conocidos, crea `NOTES_KV` solo si no existe y valida una nota sintética con limpieza posterior.

Si las credenciales de Cloudflare faltan, están revocadas o carecen de permisos, la acción debe fallar. No almacenar nunca tokens en este documento o en el repositorio.

Este archivo es solo un registro de la solicitud de activación; no almacena notas privadas ni información de autenticación.
