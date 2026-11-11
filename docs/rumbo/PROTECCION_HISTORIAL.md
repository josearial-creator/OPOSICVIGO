# Contrato de conservación del historial privado

El historial importado de Rumbo se mantiene aislado de la presentación y de las listas públicas de convocatorias.

## Datos y propiedad
- La copia primaria se guarda en `localStorage["rumbo-historial-importado-v1"]`, separada de tareas, oposiciones y otras funciones.
- La bóveda secundaria se guarda en IndexedDB, base `rumbo-boveda-historial-v1`, almacén `snapshots`. No comparte esquema ni borrados con otros módulos.
- La bóveda solo agrega versiones, identificadas por SHA-256 del JSON; no incluye métodos de borrado ni de reemplazo.
- El servicio `boveda-historial.js` es dueño de las escrituras del historial y está separado de la vista `historial-importado.js`.

## Invariantes para siguientes desarrollos
1. Ninguna actualización visual, carga de feed o despliegue debe borrar ni reinicializar estas claves/almacenes.
2. No se fusionan entradas con el mismo ID y contenidos diferentes: se notifica el conflicto y se bloquea la operación.
3. Toda importación se archiva antes de actualizar la copia primaria. Si la bóveda no admite escrituras, no se sobrescribe la copia primaria.
4. Las copias generales cifradas pueden incluir el historial, pero al restaurarlas lo combinan sin sustituir datos locales.
5. No subir los registros personales a GitHub ni a recursos estáticos de Vercel. Toda prueba debe usar datos ficticios.
6. Modificar el esquema requiere migración explícita probada con copia y validación, sin borrado implícito.

## Límites importantes
- IndexedDB y localStorage **pertenecen al mismo origen y perfil del navegador**. Cambiar de dominio, usar otro dispositivo, limpiar datos del sitio, perder el móvil, una extensión maliciosa o cambiar el código con permisos del mismo origen pueden hacer inaccesibles o borrar ambas copias.
- SHA-256 detecta alteraciones accidentales de los snapshots; no proporciona autenticidad criptográfica ante código malicioso.
- El almacenamiento local no está cifrado en reposo por este módulo. Protege contra sobrescrituras accidentales, no contra el acceso al perfil del navegador.
- `navigator.storage.persist()` puede reducir expulsiones automáticas del navegador, pero el usuario puede seguir borrando los datos.
- Una protección **realmente independiente de futuras implementaciones y dispositivos** exige una copia cifrada fuera del navegador (descargable desde «Más → Copias privadas») o un backend privado autenticado con versionado y restauración ensayada. El PR #12 sigue separado y requiere configuración manual segura.

## Pruebas
`tests/historial-importado.cjs` comprueba importación, deduplicación, conservación tras recarga, pérdida simulada de la clave local, recuperación desde bóveda y rechazo de reemplazos con mismo ID.
