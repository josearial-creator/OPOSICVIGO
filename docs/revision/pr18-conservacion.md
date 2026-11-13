# Conservación de convocatorias al actualizar

La actualización conserva las fichas ausentes del feed y las marca como «Por verificar», tanto en la tabla como en el detalle. Sus fechas se identifican como históricas.

## Identidad y datos personales

- Cuando la fuente aporta `convocatoria_id`, `expediente` o `id`, se usa junto al organismo y la edición (`anio`, `año` o `ejercicio`). Las correcciones de plazas conservan las asociaciones.
- Sin identificador oficial, se utiliza una clave conservadora con los campos anteriores, URL, edición y fechas. Cambios ambiguos crean fichas separadas; no se adivina si pertenecen al mismo proceso. El número de categoría SERGAS no identifica por sí solo una convocatoria.
- Las asociaciones antiguas de notas y favoritos se migran solo si existe una correspondencia única. Las notas ambiguas permanecen accesibles como archivadas en Apuntes de estudio y en las copias privadas. Los favoritos ambiguos conservan sus claves en la copia, sin asignarse automáticamente a otra ficha.
- Si la fuente no ofrece ningún dato que distinga dos procesos, no es posible distinguirlos de forma fiable. El siguiente paso para eliminar esa limitación es proporcionar identificadores oficiales persistentes en el productor del feed.
- Los campos ausentes de una actualización no eliminan campos anteriores de la ficha coincidente.

## Persistencia

Una copia local ilegible se conserva intacta. Si falla el guardado, se advierte al usuario. Una pestaña con una instantánea antigua rechaza la escritura cuando detecta cambios en el almacenamiento. No es una transacción entre pestañas: dos escrituras exactamente simultáneas siguen requiriendo coordinación adicional.

La versión de caché de la PWA cambia para que la aplicación instalada descargue el código actualizado.

## Revisión antes de producción

1. Ejecutar `npm test --prefix tests`, incluida `conservacion.cjs` y `conservacion-unit.cjs`.
2. Verificar copia cifrada y restauración con notas y favoritos (cubierto también en `mobile-pwa.cjs`). El exportador de convocatorias no es una copia completa.
3. Probar con una copia privada en un perfil de navegador separado; nunca incorporar datos personales al repositorio.
4. Revisar los conflictos con la rama principal antes de fusionar. No recuperar registros perdidos por sobrescrituras anteriores sin una copia externa.

Las pruebas nuevas cubren 131 fichas, coincidencias y ausencias, migración de claves, cambios de plazas con identificador, ediciones distintas, versiones ambiguas, actualización repetida, recarga, reaparición, fechas históricas, feed vacío/inválido/sin conexión, cuota agotada, otra pestaña y copia dañada. La copia cifrada se prueba con una nota y un favorito reales de prueba.
