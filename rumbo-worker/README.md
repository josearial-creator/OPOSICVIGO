# Rumbo: Pages + Workers Free + Gemini gratuito

Estado: implementación y pruebas locales; **no desplegado**. No se ha activado facturación, contratado servidores ni creado claves. No se ha llamado a Gemini real.

## Revisión del repositorio

La rama `preparar-gemini-rumbo` (79778795d8b70847c7ce2442fed86db0a9da1d01) está integrada en main por el merge 03a3095 (PR #1). Su propuesta Cloud Run/Secret Manager permanece intacta en `rumbo-ia`, pero NO se utiliza: puede requerir facturación y no satisface la condición de coste cero.

La aplicación de `docs/rumbo` procede de la copia independiente entregada por el usuario. **No es el código exacto de la aplicación de ChatGPT Sites.** No modifica ese sitio, sus datos ni el feed. Tampoco puede migrar automáticamente datos del navegador de otro dominio. Los favoritos/notas de la copia siguen bajo la clave original `rumbo-replica-v1`; evolución usa `rumbo-evolucion-v1`. Antes de cualquier migración exportar datos desde el sitio de origen. No hay acceso a los datos privados del Rumbo original desde este repositorio.

## Alternativa al backend de Pages

GitHub Pages solo sirve HTML/CSS/JS: no puede guardar una clave privada ni ejecutar Flask. Se propone Cloudflare Workers **Free**, que incluye 100 000 solicitudes/día y 10 ms CPU por invocación. No usa bases de datos, recursos de pago, cron, tarjeta, Cloud Run ni Secret Manager. Fuentes oficiales consultadas el 25/10/2026:
- https://developers.cloudflare.com/workers/platform/pricing/ (contenido verificado en el repositorio oficial cloudflare/cloudflare-docs, production/src/content/docs/workers/platform/pricing.mdx)
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages (repositorio oficial github/docs)
- Elegibilidad, modelo, límites y uso de datos de Gemini deben comprobarse en https://ai.google.dev/gemini-api/docs/pricing y https://ai.google.dev/gemini-api/docs/rate-limits antes de habilitar. Esas páginas no fueron accesibles desde este entorno (403 del proxy).

**No prometer 0 € basándose solo en cuotas o presupuestos.** Son requisitos externos obligatorios: cuenta Workers en Free y proyecto de Google AI Studio SIN facturación vinculada, elegible para el modelo gratuito gemini-2.5-flash. Si el modelo o la región no tiene acceso gratuito, NO activar: continuar manualmente. Los límites de aplicación no sustituyen esa verificación de cuenta. No añadir tarjeta, no habilitar billing, no actualizar el plan y no utilizar una clave de un proyecto facturado. No usar credenciales de la plataforma Codex como credenciales de Gemini.

## Activación pendiente (solo en cuentas del propietario)

1. Confirmar esas dos condiciones en sus paneles. Si requieren facturación o tarjeta, detenerse.
2. Crear un Worker Free usando `worker.mjs` y la configuración `wrangler.toml` (sin ejecutar los archivos de `rumbo-ia`). Conservar observabilidad desactivada para no registrar contenidos sensibles.
3. Guardar en **Secrets** del Worker `GEMINI_API_KEY` y una contraseña aleatoria `RUMBO_ACCESS_TOKEN` de al menos 32 caracteres (recomendado 32 bytes aleatorios). Nunca en vars, archivos, commits, chats o JavaScript público. No reutilizar contraseñas personales.
4. `ALLOWED_ORIGIN` debe coincidir exactamente con el origen del frontend (sin ruta). El valor propuesto es `https://josearial-creator.github.io`.
5. Solo después de verificar las cuentas sin facturación, cambiar `FREE_TIER_CONFIRMED` a `true` en el Worker. No lo habilita automáticamente ningún script.
6. El propietario obtiene la URL HTTPS real de su Worker. En Rumbo → Mi evolución → Conexión de IA y voz, introducir esa URL y la contraseña privada (NO la clave Gemini). La contraseña solo permanece en memoria; recargar exige reintroducirla. La URL sí se guarda localmente.
7. Consentir envío de texto a Gemini; en modalidad gratuita puede usarse para mejorar servicios. No enviar datos sensibles o identificativos. El consentimiento de voz es independiente: el proveedor del navegador puede procesar el audio.
8. Validar en una previsualización privada o local con origen autorizado: conversación real, respuesta JSON, errores de autenticación y cuota, dictado en dispositivo con micrófono, lectura de voz, grabación del progreso y exportación/restauración. No publicar como operativo sin esos controles.
9. Para publicar, comprobar Pages y habilitar rama main, carpeta `/docs` SOLO después de aprobación de las comprobaciones. No sustituir el JSON del feed. La URL prevista de esta aplicación, si Pages usa esa configuración, es `https://josearial-creator.github.io/OPOSICVIGO/rumbo/`; **no se ha verificado como URL publicada**. La API de GitHub Pages devolvió Forbidden en este entorno.

## Funcionamiento y límites

- Entrenamiento manual funciona sin cuentas externas: ocho habilidades, simulaciones, rúbrica, autoinformes separados, objetivos, situaciones reales, tendencias de seis sesiones, historial y copias. Sesión inicial aportada conservada sin inventar fecha/duración/desglose.
- IA: una petición explícita por evaluación; contexto de hasta seis mensajes. Pregunta de seguimiento aplicada al siguiente ejercicio. JSON validado en servidor y cliente; se conserva procedencia Gemini y criterios sugeridos, con revisión del usuario. Nunca puntuaciones inventadas si falla el servicio.
- Modelo fijo gemini-2.5-flash, sin búsqueda, herramientas, audio Gemini, reintentos ni fallback a modelos de pago. Agotar la cuota devuelve 429 y ofrece modo manual.
- Acceso privado con contraseña independiente y comprobación de origen. CORS no es autenticación; la contraseña sí se comprueba en servidor mediante hashes. No compartir esa contraseña ni configurar un proxy público sin autenticación.
- Voz: reconocimiento Web Speech del navegador, permiso y consentimiento explícitos; transcripción editable; síntesis de voz del dispositivo. Compatibilidad dependiente del navegador. No se validó micrófono físico ni un proveedor real de reconocimiento en este entorno.
- Los progresos, respuestas, evaluaciones y borradores quedan en localStorage; no hay sincronización entre dispositivos. Las credenciales no se guardan allí. Cambiar de origen exige exportar/restaurar los datos del módulo.

## Pruebas

`node --test tests/worker.test.mjs`: 7 pruebas de origen, secretos, gratuidad, autenticación, límites y contrato Gemini/errores, con upstream simulado.

Con Playwright instalado y Chromium en `/usr/bin/chromium`, servir `docs/rumbo` en 8086 y ejecutar:
```
node tests/evolucion.cjs
node tests/voz-ia.cjs
```

Las pruebas de navegador interceptan tanto el feed como Gemini; no demuestran disponibilidad en producción. Incluyen conservación de favoritos/notas, ciclos de ejercicio, emociones, tendencias, copias, registros inválidos, XSS, móvil, consentimiento, secreto solo en memoria y seguimiento conversacional. No se han ejecutado despliegues ni activado servicios externos.
