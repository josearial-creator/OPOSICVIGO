# Rumbo — fase 2: sesiones persistentes sin debilitar el cifrado
Estado: propuesta de arquitectura, **no habilitada**. Fecha: 15/11/2026.

## Situación comprobada
- El Worker autentica `/notes` y `/chat` mediante un secreto estático `RUMBO_ACCESS_TOKEN` en la cabecera `Authorization`.
- El frontend de `Mi espacio` usa el mismo secreto para derivar con PBKDF2 una clave AES-GCM que protege el borrador local; no se debe sustituir sin migración explícita.
- `Mi evolución` y la IA exigen consentimiento independiente para enviar respuestas a Gemini.
- `Copias` usa su propia frase de cifrado. Anytype es una aplicación externa y requiere su propia autenticación.
- El frontend está servido desde Vercel, el Worker desde workers.dev: son sitios diferentes. Una cookie SameSite=Lax/Strict para workers.dev no será enviada por fetch entre sitios y SameSite=None puede bloquearse como cookie de terceros.

## Requisitos de seguridad antes de una sesión de 30 días
1. **No reutilizar el secreto maestro como token de sesión**: emitir credenciales aleatorias independientes (256 bits) tras autenticación; almacenar en backend solo hashes SHA-256 del identificador de sesión, con propietario, creado, último uso, expiración absoluta y revocación. No guardar los tokens en logs.
2. **Fijar una misma frontera de origen**: desplegar el API de autenticación y notas detrás de un dominio o proxy propio en el mismo sitio que la interfaz, o usar un diseño equivalente validado en navegador, incluyendo Safari. No asumir que las cookies entre vercel.app y workers.dev funcionan.
3. **Cookies seguras**: HttpOnly, Secure, SameSite=Lax o Strict, Path limitado, caducidad absoluta ≤30 días y renovación controlada. Establecer comprobación CSRF (Origin + token anti-CSRF en operaciones que modifican datos), CORS mínimo y sin comodines con credenciales.
4. **Ciclo de vida**: cerrar sesión revoca su identificador en el servidor, no solo oculta la interfaz; control por dispositivo, cierre de todas las sesiones, rotación al autenticar y al elevar privilegios, invalidación por cambio de contraseña, rate limiting y respuesta uniforme a intentos erróneos.
5. **Separar autenticación de cifrado**: el acceso persistente a notas NO equivale a descifrar el borrador local. Solicitar frase de descifrado cuando corresponda o realizar migración criptográfica versionada, reversible y probada con muestras sintéticas; nunca almacenar el secreto maestro sin cifrar. Nunca borrar el borrador si no puede descifrarse.
6. **Autorización explícita**: no reutilizar consentimiento para Gemini, dictado ni exportaciones. Mantener copia cifrada con frase independiente; no sincronizar datos de Anytype sin su propia integración autorizada.
7. **Privacidad y despliegue**: no registrar cookies, cabeceras Authorization, tokens, notas ni credenciales; no habilitar observabilidad de cuerpos; inventariar bindings/secrets de Cloudflare antes de cambios; preservar NOTES_KV, D1 y demás almacenes. No probar con notas privadas reales.

## Plan por etapas
A. Auditoría de configuración del dominio y del Worker desplegado, inventario de secretos/bindings y validación de la política de cookies y CSRF en navegadores; no modificar datos.
B. Prototipo aislado de servidor con endpoints `POST /session/login`, `GET /session`, `POST /session/logout`, `POST /session/logout-all`, manteniendo compatibilidad con autenticación actual de /notes. Añadir expiración y revocación y tests con reloj simulado.
C. Integración de frontend usando una única sesión de autenticación y una petición separada cuando haga falta desbloquear el borrador local. Mostrar «Dispositivo de confianza» como opción opt-in, inicialmente desactivada.
D. Migración gradual con feature flag desactivado por defecto, sin rotación del secreto actual ni cambios de NOTES_KV. Probar login correcto/incorrecto, CSRF, CORS, expiración, revocación, reintento, sesiones simultáneas, móvil, Safari, cierre y restauración de copia.
E. Validación manual con notas sintéticas, copia exportable verificada, aprobación explícita, despliegue reversible y seguimiento de errores sin datos sensibles.

## Criterios de aceptación
- 30 días de sesión como **límite máximo**, no garantía de conectividad; se puede revocar en cualquier momento.
- Un token robado no concede acceso después de logout o expiración; la cookie no es legible desde JavaScript.
- Sin contraseña repetida para navegar entre notas tras la autenticación, pero sin descifrado silencioso del borrador si requiere frase.
- No se altera el contenido ni los IDs de notas y entradas históricas; copias de prueba restauran antes y después.
- Controles automáticos y prueba manual desde Vercel y dispositivos reales superados antes de publicación.

**Decisión:** no implementar todavía una cookie de 30 días en el Worker actual: el diseño cross-site y el uso dual del secreto para cifrar borradores hacen insegura una sustitución directa.
