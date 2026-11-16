# Puerta de entrada segura de Rumbo — decisión de diseño (NO desplegada)
 
## Objetivo
Usar una cookie de sesión segura de hasta 30 días desde `https://oposicvigo.vercel.app`, sin guardar la contraseña en almacenamiento del navegador y conservando el acceso a las notas de `NOTES_KV` y el cifrado local de borradores.
 
## Hechos comprobados en el código (16-11-2026)
- `vercel.json` solo enruta web estática del servicio `app`; no proporciona todavía una API de primer origen.
- El frontend `docs/rumbo/mi-espacio.js` llama directamente a `https://rumbo-entrenador.jose-arial.workers.dev` con cabecera Authorization; la contraseña desbloquea además AES-GCM del borrador.
- `rumbo-worker/worker.mjs` solo acepta autenticación mediante cabecera Authorization.
- `session-prototype.mjs`, `private-gateway-prototype.mjs` y `notes-session-guard.mjs` están desconectados de producción.
- La cookie `SameSite=Strict` de un host `workers.dev` no es un sustituto de una API first-party `vercel.app`. Tampoco debe relajarse a `SameSite=None` sin rediseño y controles específicos.
 
## Arquitectura prevista (por implementar y auditar)
1. Exponer `/api/rumbo/{session,session/login,session/logout,notes,...}` en **el mismo origen del frontend** mediante servicio de proxy de confianza en Vercel, o una topología equivalente y contrastada.
2. Hacer que el proxy acepte únicamente rutas y métodos explícitos, rechace hosts no permitidos, limite tamaño de solicitudes, no permita URL de destino arbitraria y añada `Cache-Control: no-store`.
3. Autenticar **el proxy frente al Worker** con una credencial de servicio distinta de `RUMBO_ACCESS_TOKEN`; evitar que un cliente pueda falsificar cabeceras internas. La API Worker de sesiones debe rechazar cualquier llamada directa no autenticada del público.
4. No confiar en cabeceras `X-Forwarded-For`, `CF-Connecting-IP` u otras facilitadas por el usuario sin validarlas en la frontera de confianza. Identificar allí al cliente para un rate limiter atómico y compatible con varios Workers.
5. Normalizar y validar las cabeceras Origin/Host que representen el **origen público**. Prohibir enviar cookies de sesión al Worker público desde el navegador directamente.
6. Conservar comprobación CSRF en toda mutación (y `Origin` verificado) y acceso revocable mediante D1 con lectura desde primario.
7. Desacoplar la clave AES-GCM de borradores: el login persistente puede mostrar notas del servidor, pero un borrador local previo debe permanecer intacto hasta que el usuario suministre su antigua contraseña o clave de recuperación. No sobreescribir borradores indescifrables.
 
## Condiciones de aceptación, antes de fusionar
- CI y test E2E con datos sintéticos: login, recarga, reapertura, expiración, cierre, revocación, error de proxy, intento CSRF, fuerza bruta y acceso directo Worker.
- Copia exportada de notas y prueba de recuperación del borrador en navegador.
- Revisión de despliegue y variables de Cloudflare y Vercel. Migración D1 separada; no alterar `NOTES_KV`, `RUMBO_ACCESS_TOKEN` ni `GEMINI_API_KEY`.
- Plan de reversión probado sin pérdida de notas y con bandera de sesión desactivada por defecto.
 
**Estado:** documento de diseño. No configura Vercel, Cloudflare ni producción.
