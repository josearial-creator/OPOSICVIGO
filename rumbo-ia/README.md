# Rumbo IA — preparación (no desplegado)

Este directorio es un backend **separado** del recolector de convocatorias. No altera las convocatorias, favoritos, notas ni la web Rumbo.

## Estado
- Código preparado en la rama `preparar-gemini-rumbo`.
- **No se ha creado ninguna clave API ni desplegado ningún servicio.**
- **No está conectado todavía a la interfaz de Rumbo.**
- La transcripción de voz y el guardado de registros **no están implementados** en este backend.

## Seguridad
- La clave `GEMINI_API_KEY` debe guardarse en Google Secret Manager, nunca en GitHub ni en JavaScript del navegador.
- Se exige token de Firebase Authentication en `Authorization: Bearer <ID_TOKEN>`.
- `ALLOWED_FIREBASE_UID` restringe el acceso a una única cuenta. Requiere un proyecto Firebase y su autenticación habilitada.
- Configurar CORS solamente para el dominio de Rumbo, tras confirmar el dominio. Por defecto no se permite acceso desde navegadores de otros orígenes.
- La API gratuita de Gemini puede procesar datos para mejorar servicios; **no enviar información clínica privada** sin evaluar condiciones y privacidad.
- Cloud Run puede requerir facturación y puede generar costes. Establecer cuotas y alertas de presupuesto.

## Próximos pasos
1. Confirmar repositorio/código de la web Rumbo (este repositorio contiene el feed de oposiciones).
2. Crear clave Gemini en un proyecto elegible y guardarla en Secret Manager.
3. Configurar Firebase Authentication, `ALLOWED_FIREBASE_UID` y credenciales de servicio.
4. Desplegar en Cloud Run con `GEMINI_API_KEY` como secreto y validar acceso.
5. Integrar chat y transcripción en la web, y almacenamiento privado de registros con consentimiento y controles de borrado.
