# Recepción de reflexiones de ChatGPT — contrato propuesto

El conector antiguo de Sites no está configurado desde este repositorio. Esta modificación prepara únicamente el receptor de Rumbo moderno; no acredita un envío real desde Sites.

## Transporte existente
- Backend privado: rumbo-entrenador, ruta POST /notes ya autenticada, con CORS vigente.
- El emisor debe utilizar la credencial autorizada **solo en su servidor privado**; no publicarla ni incluirla en código cliente, GitHub, mensajes, logs o URLs. El servidor actual exige un origen autorizado: comprobarlo antes de conectar; no ampliar CORS indiscriminadamente.
- Cuerpo: JSON con text que contiene un JSON de tipo rumbo-chatgpt-reflection-v1, y createId (UUID estable por referencia de origen, reutilizado al reintentar). No enviar un objeto de reflexión directamente como si fuese una nota.
- Ejemplo completamente ficticio del contenido de text:

```json
{"type":"rumbo-chatgpt-reflection-v1","record":{"id":"fixture-1","sourceReference":"fixture-chat-1","date":"2026-11-19","title":"Ejemplo ficticio","summary":"Resumen de prueba","reported":"Texto ficticio","conversationUrl":"","recordedAt":"2026-11-25T07:00:00Z"}}
```

Conservar el ID original, la fecha original (Europe/Madrid), la referencia estable, y los campos textuales sin inventar. La ruta actual limita text a 10.000 caracteres y el cuerpo a 12.000: rechazar si excede los límites, no truncar. Si POST devuelve conflicto, no sobrescribir. Verificar GET /notes tras el envío. Una reflexión con texto ordinario no se reconoce como reflexión estructurada.

## Receptor
Al abrir el acceso privado, entrar en Historial o comprobar sincronización, lee GET /notes tras recuperar las copias cifradas del historial. Integra únicamente el formato explícito, conserva los registros existentes y detecta conflictos por ID o referencia. El historial local y su copia cifrada usan el mecanismo existente. No usa GitHub como almacén de información personal. El transporte /notes tiene las mismas condiciones de almacenamiento que Mi espacio y sus registros pueden aparecer allí como notas; no utilizar el borrado global del diario como mecanismo de limpieza. El emisor original debe conservar su copia. El registro recibido no es un diagnóstico ni una confirmación de que se han leído todos los chats.

## Verificación
Pruebas de navegador con datos sintéticos en tests/history-cloud.cjs. Falta modificar el emisor de Sites, confirmar su autenticación y comprobar un envío sintético real en el dominio habitual. No fusionar ni publicar como una reparación completa hasta verificar los requisitos anteriores.
