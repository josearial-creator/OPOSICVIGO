# Rumbo — revisión de seguridad, convocatorias y panel Hoy (2026-11-13)

## Alcance y situación de partida

- Base: main posterior a la integración del PR #18 (conservación de convocatorias).
- Protección del historial: PR #19 ya integrado (bóveda IndexedDB y fusión sin sustitución).
- Importación de la copia privada: PR #21 ya integrado (selector local desde Inicio).
- Entrenamiento estructurado de 10 segundos: PR #22 permanece abierto. No se ha fusionado y esta propuesta no lo modifica.
- Mi espacio autenticado: PR #12 aún pendiente de configuración y validación real. No se considera activado.
- No se publican secretos ni registros personales en este repositorio.

## Cambios propuestos en esta rama

1. Integridad al recuperar registros: si la importación contiene un ID ya existente con contenido distinto, la operación se rechaza sin tocar la copia local ni la bóveda.
2. Ficha oficial por plaza: el scraper de Vigo relaciona el texto del nombre con el enlace plaza.jsp?id=..., y lo guarda en fuente_detalle solamente cuando aparece un enlace HTTPS de la sede oficial. No se inventan URLs.
3. Identidad estable: fuente sigue siendo el buscador y fuente_detalle no altera la clave de notas, favoritos ni convocatorias. Para registros sin ficha individual se muestra que el enlace es al buscador.
4. Apertura conservadora: un estado abierto requiere inicio y fin completos y válidos, que cubran el día local. Si el feed declara apertura sin fechas, se muestra Por verificar. No sustituye la consulta de las bases.
5. Hoy simplificado: tarjeta compacta al inicio de Mi día, lectura no destructiva de la primera prioridad, tres rutinas voluntarias y una pausa guiada de diez segundos con decisión.
6. Datos de rutina aislados: clave rumbo-rutinas-hoy-v1, validación estricta, protección ante pestañas, bloqueo de datos corruptos y copia cifrada disponible. Diferente de rumbo-pausa-10s-v1 del PR #22.
7. Caché PWA: nueva versión con los archivos añadidos, sin tocar los almacenes.

## Pruebas

- node tests/estado-convocatorias.cjs: fechas, identidad y URL segura.
- python3 -m unittest discover -s tests -p 'test_actualizar_*.py': HTML sintético, enlace exacto y rechazo de dominios ajenos.
- node tests/rutinas-hoy.cjs: navegador, pausa de diez segundos, persistencia, conflicto entre pestañas, copia incompatible y conservación de otros datos.
- tests/historial-importado.cjs: rechazo de ID repetido con contenido distinto.
- Workflow Comprobar Rumbo: revisar resultado de CI antes de aprobar.

## Comprobaciones manuales pendientes

1. Hacer una copia cifrada de registros en un archivo privado externo; comprobar restauración en navegador de prueba. Verificar el total esperado sin publicar el contenido.
2. Ejecutar la actualización del feed en una revisión controlada, contrastar enlaces e IDs con fichas oficiales y revisar procesos con nombres repetidos. No ejecutar en producción sin autorización.
3. Probar en móvil y escritorio la pausa, las rutinas y la conservación tras recarga.
4. Revisar cambio de dominio y limpieza de datos del navegador; la bóveda local no sobrevive necesariamente.
5. Comprobar que cualquier vista previa automatizada, si existe, no expone datos. No ejecutar despliegue ni fusión.

## Límites

- No se ha restaurado nada en la web publicada: la recuperación requiere elegir el archivo privado en el navegador.
- Sin sincronización entre dispositivos: backend autenticado sin configurar o verificar.
- Los enlaces individuales aparecerán tras volver a procesar la fuente; no se inventan para el JSON anterior.
- La pausa es un autoinforme voluntario, no mide capacidad clínica, y no configura alarmas.
