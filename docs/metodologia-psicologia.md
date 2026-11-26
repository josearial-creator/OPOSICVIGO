# Rumbo Psicología — protocolo de investigación personal v1.0 (propuesta)
Fecha: 2026-11-24. Diseño metodológico, no instrumento clínico validado. No contiene información de pacientes.

## Objetivo
Convertir registros voluntarios en evidencia trazable para una formulación individual revisable con un profesional. No diagnosticar, prescribir, cambiar medicación ni sustituir atención sanitaria. No es un servicio monitorizado de urgencias.

## Flujo
1. Captura original con ID estable, fecha del acontecimiento (si consta) y del registro por separado, procedencia y consentimiento. No leer chats inaccesibles, ni duplicar, sobrescribir correcciones o reimportar eliminados.
2. Clasificación multietiqueta por dimensión mediante un esquema versionado. Distinguir pensamiento referido, emoción referida, conducta referida, situación antecedente, consecuencias a corto/largo plazo y factores contextuales. Marcar negación, temporalidad, atribución a otra persona y ambigüedad. Abstenerse si no se puede determinar.
3. Para cada observación: ID fuente, fragmento exacto y posición, categoría, subtipo, autor de la afirmación, fecha, método/versión de análisis, estado de revisión (pendiente/aceptado/corregido/rechazado). Una inferencia no es una cita. No inventar intensidad ni afirmar ausencia por falta de mención. No interpretar un resumen de IA como palabras del paciente.
4. Hipótesis separadas: mecanismo propuesto, explicaciones alternativas, evidencias favorables y contrarias, incertidumbre, predicción verificable y estado (abierta/apoyada provisionalmente/no apoyada/insuficiente). Las asociaciones no demuestran causalidad.
5. Revisión longitudinal: número de registros y días cubiertos, temas mencionados por días con registro (no prevalencia de síntomas), autovaloraciones con escala original y cuestionarios validados aplicados íntegramente. No mezclar escalas, convertir menciones a puntuaciones o imputar días vacíos. Mostrar cambios de hábitos de registro, selección, contexto y posibles confusores. Diferenciar retrospectivo de EMA prospectiva.
6. Propuestas de actuación: objetivos acordados, posibles estrategias con fuentes verificables, indicación de limitaciones y pertinencia individual; siempre propuestas para valorar con profesional, nunca diagnóstico o tratamiento autónomo. Medidas de funcionamiento, bienestar y efectos adversos. No fomentar comprobaciones repetidas ni uso compulsivo.
7. Evaluación individual: periodo de referencia, objetivo observable, intervención acordada, resultado primario, calendario razonable, cambios simultáneos (sueño, circunstancias, tratamiento), criterios de revisión/retirada, registro de resultados negativos. No interrumpir tratamientos ni realizar experimentos clínicos sin supervisión. No prometer causalidad con un simple antes/después.

## MVP y criterios de aceptación
- Análisis local de textos, sin salida a servicios externos; guardado cifrado, con revisión y exclusión de textos ambiguos. Separar automatizar clasificación de autorizar almacenamiento. Procesamiento de diario remoto solo tras diseño y validación de privacidad.
- Motor semántico posterior: extracción estructurada con evidencia textual comprobable; no debe operar sobre datos reales hasta validar y autorizar entorno, destinatarios, retención, revocación y borrado. No usar repositorio público para datos sanitarios.
- Pruebas sintéticas de negación, ironía, cita de terceros, pasado/futuro, ambigüedad, hechos contrapuestos, múltiples etiquetas, ausencia de puntuación, fecha, deduplicación y exclusiones.
- Validación: dos revisores independientes con manual de codificación; conjunto de evaluación separado del desarrollo, precisión y exhaustividad por categoría, acuerdo entre revisores, tasa de abstención, errores de atribución y fechas, revisión clínica de recomendaciones. Medir errores de alto impacto y sesgos. Cualquier umbral de aceptación debe preespecificarse y acordarse con profesionales; no hay rendimiento demostrado.
- Evaluar utilidad: tiempo de revisión, correcciones, carga percibida, impacto funcional y posible aumento de rumiación/comprobación. No inferir eficacia clínica sin estudio adecuado.
- Informes: periodo, cobertura, datos declarados, inferencias, hipótesis y alternativas, resultados de estrategias, fuentes y limitaciones. Exportación voluntaria; acceso profesional solo tras garantías de seguridad y consentimiento.

## Fundamento (no validación de Rumbo)
- Análisis funcional idiográfico: https://journals.copmadrid.org/clysa/art/cl2013a13
- Measurement feedback systems: revisión sistemática y metaanálisis https://doi.org/10.1007/s10488-022-01236-9
- EMA, limitaciones metodológicas: https://doi.org/10.1146/annurev-clinpsy-080921-083128
- Validación individual de hipótesis de formulación cognitivo-conductual: https://doi.org/10.1002/cpp.2298
- Protocolo PACT de formulación y planificación basada en mecanismos: https://pmc.ncbi.nlm.nih.gov/articles/PMC8247980/

## Extensión experimental evidencia-1.0
El grado de evidencia textual (1: estado expresado; 2: magnitud explícita o acción concreta referida; 3: consecuencia funcional explícitamente vinculada) describe el tipo de información presente, no la intensidad, veracidad, probabilidad diagnóstica ni cambio clínico. Una ausencia expresada no equivale a grado cero. Se conservan únicamente puntuaciones explícitas para dimensiones de dificultad admitidas en escalas 0–4 y 0–10, sin conversión y sin mezclarlas con autovaloración manual. Si hay valores contradictorios, no se elige uno. Se mantienen los fragmentos, la orientación, las limitaciones de fecha y el procesamiento local. Los registros antiguos conservan su esquema; las nuevas reglas solo se aplican al revisar texto disponible no guardado previamente por dimensión. No reimportar observaciones eliminadas. No se añaden datos personales al repositorio. Validación pendiente en CI, navegador y corpus independiente de revisión profesional.
