# Contraseña personal permanente — especificación segura (pendiente de activación)

## Experiencia
- El propietario elige una **contraseña de acceso que no caduca automáticamente**.
- En «Mi espacio → Seguridad → Cambiar contraseña» introduce **contraseña actual**, **nueva** y **confirmación**.
- La nueva contraseña se exige para futuros inicios; la sesión se puede conservar durante un máximo de 30 días por dispositivo.
- Cerrar todas las sesiones debe invalidar inmediatamente las anteriores.
- La opción «He olvidado mi contraseña» **no podrá recuperar un borrador cifrado por sí sola**: requiere un procedimiento independiente de recuperación del cifrado, establecido y comprobado antes de reemplazar el sistema actual.

## Requisitos del servidor
1. Verificar la contraseña antigua en el servidor con un verificador derivado de contraseña, sal aleatoria y KDF calibrado. La tabla de preparación propone PBKDF2-SHA256 con 600 000 iteraciones como mínimo, sujeto a revisión de coste, disponibilidad y controles de bloqueo. Preferir Argon2id si el entorno lo soporta de forma segura.
2. No conservar la contraseña en claro, ni en localStorage, logs, repositorios, variables Vercel, ni en una cookie. Usar un almacén privado D1 con transacciones que impidan actualizaciones concurrentes de credenciales.
3. Aplicar limitación de intentos a login y cambio, con identificación de cliente fiable; comprobar la sesión, Origin y CSRF en cada modificación.
4. Cambiar el verificador y revocar **todas** las sesiones de forma atómica, o mediante versión de autenticación validada en cada petición. La revocación parcial no se admite.
5. Conservar el Worker actual hasta verificar la migración, probar cierre de sesión y disponer de copia de seguridad y reversión.
6. Migrar/recifrar borradores locales **en el navegador**, con la contraseña antigua y la nueva, mediante operación verificable sin sobrescribir el anterior hasta comprobar el descifrado. El servidor no debe recibir textos del borrador ni contraseñas de cifrado innecesarias.
7. Si falla el recifrado, detener el cambio y conservar el borrador original; no anunciar cambio exitoso antes de confirmarlo.

## Estado
La tabla SQL de este PR es **un diseño aislado**: no integra el servidor ni cambia el secreto existente. No activa «Cambiar contraseña», ni configura cuentas o sesiones en producción.
