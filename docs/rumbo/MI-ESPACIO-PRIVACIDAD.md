# Mi espacio: diario privado
La interfaz se encuentra en `docs/rumbo/mi-espacio.js` y usa el Cloudflare Worker existente.
No guarda anotaciones en archivos públicos, ni en el `localStorage` de notas existentes.
El borrador se conserva cifrado con AES-GCM mediante una clave derivada de la contraseña que se vuelve a solicitar al abrir.

## Requisito de despliegue (obligatorio)
1. Crear un namespace Cloudflare Workers KV privado en la cuenta propietaria.
2. Vincularlo al Worker `rumbo-entrenador` mediante la variable de binding `NOTES_KV` (Cloudflare Dashboard > Workers & Pages > Worker > Settings > Bindings). No incluir su identificador ni secretos en archivos públicos.
3. Mantener `RUMBO_ACCESS_TOKEN` como secreto de Worker de mínimo 32 caracteres. Se verifica en el servidor para cada acceso.
4. Desplegar el nuevo `rumbo-worker/worker.mjs` y `notes-api.mjs` tras comprobar las pruebas. Publicar después los archivos de `docs/rumbo`.
5. Probar acceso sin token, con token inválido y correcto; crear, editar, cerrar sesión, reabrir, recuperar borrador, borrar y exportar.
Sin binding, el servicio responde 503 y **no afirma guardar nada**.

## Advertencias
- GitHub Pages es público: la seguridad del diario depende del Worker privado y de proteger la contraseña.
- La contraseña actual de Rumbo identifica un único propietario; esto no es una infraestructura multiusuario.
- Los proveedores de dictado de voz del navegador pueden procesar el audio; el usuario lo activa expresamente.
- Se mantiene la sección antigua «Diario»; no se migran ni borran registros.
- No se llama a Gemini ni OpenAI con el texto de las notas; ninguna reflexión automática.
- Workers KV tiene consistencia eventual; no debe utilizarse como diario multiusuario transaccional.

## Revisión de reparación — 13/11/2026
Se incorpora main conservando diseño móvil, historial recuperado, copias privadas y protección del feed de convocatorias. El reintento usa un UUID conservado dentro del borrador cifrado, también tras recargar. Si la nota ya existe con otro contenido se responde 409 sin sobrescribirla. Los borradores anteriores siguen siendo legibles.

KV sigue teniendo consistencia eventual: esta corrección evita claves duplicadas al reintentar, pero no ofrece edición transaccional concurrente entre dispositivos ni protege frente a todas las carreras entre una edición y un reintento antiguo. Para esa garantía se requiere control transaccional de versiones; no anunciar todavía esa capacidad.

El workflow manual toma el SHA seleccionado y bloquea el despliegue si no existe una configuración explícita de NOTES_KV. No crea ni cambia almacenes por sí solo. Antes de autorizarlo se deben comparar TODOS los bindings reales del Worker con la configuración (incluido D1 db), preservar secretos y establecer NOTES_KV privado. No se han leído ni modificado tablas D1.

ALLOWED_ORIGIN admite únicamente los orígenes explícitos de GitHub Pages y ambos dominios Vercel conocidos. No hay comodines.

Pendiente: verificación administrativa Cloudflare, configuración de NOTES_KV, prueba real del secreto existente, despliegue aprobado y almacenamiento real con notas sintéticas. No se han incluido datos personales ni secretos en estos cambios.
