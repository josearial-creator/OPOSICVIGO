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
