# Rumbo · Mi entrenamiento (fase 1)

El módulo deportivo es independiente de los módulos Diario, Mi evolución, Productividad y Convocatorias.
No modifica ni reutiliza sus claves de almacenamiento. Se añade a la navegación principal.

## Qué hace

- Importa el **CSV «Todas las actividades» de Garmin Connect**. Admite los separadores coma y punto y coma, comillas y encabezados habituales en español e inglés.
- Importa y exporta copias JSON con estructura \`{"version":1,"activities":[],"measurements":[]}\`.
- Permite dar de alta manualmente una actividad.
- Guarda en **IndexedDB del navegador actual**. No sube datos deportivos a GitHub ni a servidor.
- Muestra actividades, kilómetros, VO₂ máximo aportado, umbral aportado, pronóstico de media maratón, gráficas mensuales y ritmo de carrera.
- Evita duplicados por ID de Garmin y coincidencia de fecha, distancia y duración. Respeta notas históricas.

## Importar datos

1. Abre Garmin Connect web → Actividades → Todas las actividades → Exportar CSV.
2. En Rumbo → Mi entrenamiento pulsa «Importar CSV o JSON» y elige el CSV.
3. Comprueba los datos y descarga «Exportar copia privada JSON» para conservarlos en otros dispositivos.

Para importar un resumen de conversaciones analizadas, se puede preparar una copia privada compatible y cargarla del mismo modo. **No incluyas archivos con datos personales en el repositorio público.**

## Limitaciones de esta fase

- **No** existe sincronización en segundo plano con Garmin. El usuario importa archivos cuando lo desee.
- **No** se decodifican todavía FIT, TCX, GPX ni ZIP, por lo que no hay curvas por segundo, posición GPS o laps detallados.
- Las gráficas no equivalen a diagnóstico médico ni comparaciones validadas de rendimiento.
- Se almacenan los datos por navegador/perfil. Borrar los datos del sitio o cambiar de dispositivo puede hacer perder el historial si no se exporta una copia.
- La importación CSV depende de encabezados y unidades: si una exportación de Garmin utiliza otro formato, ajustar el adaptador antes de importar.
- El valor máximo de FC de una actividad se conserva aunque pueda contener picos erróneos; se debe contrastar con los gráficos.
- El archivo histórico de ChatGPT se entrega **separado** al usuario y no se versiona.

## Fases siguientes

2. Ampliar el importador a archivos FIT/ZIP con curvas, vueltas y pruebas de fidelidad.
3. Añadir backend privado, autenticación y copias cifradas para conservar el historial entre dispositivos.
4. Conectar Garmin Personal API exclusivamente desde backend autenticado (nunca exponer la clave en JS público, localStorage o GitHub). Añadir sincronización incremental, caducidad/revocación de clave, gestión de fallos y API rate limits.
5. Integrar un plan semanal de entrenamiento y comparativas normalizadas por terreno, FC y esfuerzo.

## Pruebas

\`node --test tests/entrenamiento.cjs\`

Cubre CSV inglés y español, fechas inválidas y deduplicación. Revisar manualmente con un navegador después de cada actualización del panel.
