# Rumbo ↔ ChatGPT: recepción cifrada (versión inicial)

## Propósito y estado

Función optativa en la **copia independiente** de Rumbo publicada desde `docs/rumbo`. No equivale a modificar la versión privada de ChatGPT Sites. **No puede leer ni modificar registros del navegador de otro dominio**. No se han introducido registros personales.

Permite que, cuando el propietario lo pida en ChatGPT, ChatGPT guarde un registro **cifrado** en `docs/rumbo-sync/inbox.json` mediante la conexión existente de GitHub. La web lo incorpora al diario local `rumbo-evolucion-v1` al abrirla o pulsar «Incorporar registros de ChatGPT». Los demás registros, notas y favoritos permanecen intactos; cada entrada tiene un identificador estable y no se duplica. No altera el recolector de oposiciones.

## Vinculación inicial (una sola vez)

1. Abrir el apartado **Diario → Conectar ChatGPT** de la web vinculada a **este repositorio**, con HTTPS.
2. Elegir una frase de recuperación de al menos 12 caracteres. Crear vínculo seguro; guardar el archivo `rumbo-recuperacion-*.json` cifrado y la frase **por separado**. No compartir estos dos secretos con ChatGPT ni subirlos al repositorio.
3. Pulsar «Copiar clave pública» y **pegar solo ese JSON público** en ChatGPT, solicitando vincular esta bandeja. La clave pública incluye `keyId` y `spki` en base64. ChatGPT la puede guardar como `docs/rumbo-sync/public-key.json` en GitHub, **sin datos privados**.
4. Después, pedir en ChatGPT «Registra en Rumbo ...». ChatGPT debe localizar la clave pública ya vinculada y añadir la entrada cifrada al `inbox.json` sin sobrescribir elementos previos. No escribir la información sin cifrar en issues, mensajes de commit, logs ni repositorio.
5. Abrir Rumbo para incorporar las entradas automáticamente o pulsar «Incorporar registros de ChatGPT» si ya estaba abierto.

Si se cambia de dispositivo, usar «Restaurar clave» con el archivo y la frase de recuperación. Si se borran datos del navegador **y** se pierde la copia, las notas históricas cifradas pueden quedar irrecuperables.

## Contrato de datos

Clave pública:
```json
{"type":"rumbo-sync-public-key","version":1,"keyId":"24 hex","spki":"base64 DER SubjectPublicKeyInfo RSA-OAEP 3072"}
```

Bandeja:
```json
{
  "version": 1,
  "items": [
    {"id":"uuid-único","keyId":"24 hex","wrappedKey":"base64","iv":"base64","ciphertext":"base64"}
  ]
}
```

El cliente acepta identificadores alfanuméricos, guiones o guion bajo, de 8 a 70 caracteres.

**Cifrado híbrido obligatorio para el escritor ChatGPT:** importar `spki` como RSA-OAEP con SHA-256; generar una clave aleatoria AES-256 para cada entrada; cifrar el objeto JSON `note` con AES-GCM y nonce aleatorio de 12 bytes; cifrar AES con RSA-OAEP-256 y codificar los bytes en base64 estándar. El `ciphertext` de AES-GCM contiene el tag al final.

Texto claro **solo dentro del cuerpo cifrado**:
```json
{"id":"uuid-único","date":"2026-10-26","context":"Hecho relevante","response":"Qué hice","felt":"Emociones expresadas por mí","improve":"Qué me ayudó o probaré"}
```
No inventar emociones ni puntuaciones: usar cadenas vacías para datos ausentes. Limitar cada campo a 6000 caracteres. `note.id` debe coincidir con `items[n].id`.

Al añadir entradas, leer primero el archivo completo y su SHA, comprobar si existe el ID, agregar el envelope y actualizar usando **el SHA actual**. Evitar cambios concurrentes sin relectura. No reescribir ni borrar elementos anteriores. No hay autenticación pública de escritura: solo el propietario del repo puede escribir a través de GitHub; cualquiera puede **leer ciphertext** y ver frecuencia y tamaño aproximado de entradas.

## Seguridad y límites

- El repositorio es **público**. Solo se deben subir claves **públicas** y mensajes **cifrados**; nunca notas en texto claro, copias de recuperación o contraseñas. No guardar datos médicos o psicológicos en ficheros públicos sin cifrar.
- La clave privada se guarda en IndexedDB como `CryptoKey` **no exportable**. Existe copia de recuperación cifrada con AES-256-GCM y PBKDF2-SHA256 (310 000 iteraciones), descargable posteriormente desde el mismo dispositivo. Ni el script ni ChatGPT reciben la clave privada.
- No incluye sincronización bidireccional, lectura desde ChatGPT de notas locales, escritura de notas locales en GitHub ni actualización en tiempo real mientras la página permanece abierta.
- No promete acceso a la web original de ChatGPT Sites, ausencia absoluta de exposición de metadatos, ni garantía de preservación de claves si se pierde el archivo de recuperación.
- Conservar copias exportadas de Rumbo para recuperarse de daños del navegador. El frontend solo lee del repositorio y guarda en localStorage.
- La función debe verificarse en HTTPS real y móvil antes de anunciarla como completamente operativa.
