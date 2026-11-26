# Motor semántico experimental de Rumbo
Prototipo separado de producción. No contiene conversaciones reales y no acepta archivos de usuario. No es un instrumento clínico validado. El propósito es comprobar si un modelo de lenguaje local aporta valor frente a reglas explícitas antes de conectarlo a la aplicación.

## Ejecución
Requiere Node.js 20+ y un servicio Ollama **local** con un modelo descargado e instalado. No se configura ni instala automáticamente el modelo; comprobar memoria disponible, licencia y que no se usa un modelo remoto. El runner solo solicita 127.0.0.1:11434, no sigue redirecciones y utiliza exclusivamente el corpus sintético incluido.
- `node --test experiments/semantic/validator.test.mjs`
- `node experiments/semantic/evaluate.mjs NOMBRE_MODELO_LOCAL`

El resultado JSON incluye etiquetas, citas comprobables, índices, alternativas y errores. Se informa precisión y exhaustividad micro por etiqueta y dirección, además de etiquetas prohibidas y rechazos. El corpus de veinte casos es **de desarrollo**, no evidencia de rendimiento independiente. Los resultados deben revisarse a mano: las etiquetas alternativas plausibles no siempre son errores clínicos, y una cita literal no prueba la inferencia. Las puntuaciones de evaluación son del motor, no del usuario. No se asigna intensidad a partir de lenguaje.

## Antes de integrar en producción
1. Revisar privacidad, modelo, accesos, registros del servidor, retención y borrado; bloquear salidas de red del proceso y confirmar que el servicio no está expuesto. Consentimiento específico antes de tratar datos personales.
2. Preparar corpus independiente, manual de codificación y dos revisores humanos. Medir precisión, exhaustividad, acuerdo, abstenciones, errores de atribución, negaciones, temporalidad y conclusiones incompatibles. No fijar umbrales clínicos arbitrarios.
3. Comparar contra el motor de reglas y revisar casos en que discrepan. Evaluar especialmente las inferencias indirectas y alternativas. Las citas de terceros dentro de mensajes del usuario requieren interpretación humana; el validador solo verifica autor del mensaje y literalidad.
4. Diseñar un adaptador privado opt-in hacia el Observatorio, solo propuestas pendientes de revisión, con fuente, versión, fecha del registro y del suceso si consta. Nunca guardar automáticamente una interpretación ni mezclarla con intensidad declarada. No modificar la bóveda ni sincronizar datos sin autorización.
5. Validar con navegador, pruebas de seguridad y revisión profesional antes de activar. No utilizar este prototipo para asistencia clínica ni monitorizar urgencias.

Este experimento es independiente de las PR anteriores del Observatorio y no activa Vercel ni modifica el backend.

## Comparación y diagnóstico del servidor
`bash experiments/semantic/preflight.sh` comprueba CPU, memoria, disco, Node, Ollama, escucha local y modelos sin instalar nada. Ejecutar solo en el servidor propio. El evaluador incluye ahora una referencia del motor de reglas sobre los mismos episodios ficticios y latencia por ejemplo. Se han añadido casos de ánimo, disfrute, atribución de terceros y preocupaciones fundadas. Las etiquetas esperadas son propuestas del desarrollador: no son un patrón oro; revisar etiquetas adicionales plausibles y validar un conjunto independiente. No usar resultados de desarrollo para afirmar eficacia clínica.
