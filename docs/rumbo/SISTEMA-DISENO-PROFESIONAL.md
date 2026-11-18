# Rumbo — Sistema profesional de interfaz (v1, 18/11/2026)

## Referencias y principios
- Referencia conceptual: Material Design 3 (Google); **no** se afirma cumplimiento oficial ni relación con Google.
- Accesibilidad: WCAG 2.2 AA como objetivo evaluable (contraste, nombres accesibles, foco, zoom, operabilidad por teclado y controles táctiles). Se recomienda objetivo de **44 × 44 px** para controles de uso táctil.
- Diseño: escala de espaciado de 4 px; tipografía del sistema sin carga de fuentes remotas; superficies neutras, un acento primario, elevación discreta, radios consistentes y estados visibles de selección.
- Interacción: una ruta visible, una acción principal por contexto y conservación de los enlaces directos por fragmento.
- Rendimiento: objetivos de Core Web Vitals en percentil 75: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1; medición real pendiente (no son resultados).
- Reversibilidad: una capa CSS final (`producto-profesional.css`) que puede desconectarse sin migrar ni tocar datos.

## Contrato de compatibilidad
- No modificar ni borrar localStorage, IndexedDB, cookies, notas, datos importados, Worker, KV, D1, contraseñas o endpoints desde estilos.
- No publicar ni distribuir información personal como datos estáticos.
- `index.html`: referencia a la nueva hoja y enlace «Saltar al contenido».
- `mobile.js`: solo intercepta el salto accesible; no cambia rutas o persistencia.
- `sw.js`: nueva versión de caché para que no se mezcle HTML nuevo con CSS antiguo.
- Mantener visualización por secciones independientes en escritorio y móvil.

## Validación obligatoria antes de fusionar
1. `Comprobar Rumbo` en GitHub Actions verde.
2. Vistas 320, 390, 560, 768 y 1120 px sin desplazamiento horizontal.
3. Acceso por teclado, foco visible, botones y lectura a zoom 200 %.
4. Pantallas: Inicio, Mi día, Convocatorias, Mi espacio, Diario, Productividad, Proyectos; controles principales operativos.
5. Recargar con registros sintéticos y comprobar igualdad de los almacenes de datos.
6. Comprobación real en Android/iOS y Safari; si no hay dispositivo disponible, dejar constancia.
7. Desplegar producción solo después de estas verificaciones y sin tocar configuración privada.

## Alcance actual y límites
Esta entrega implementa una primera unificación visual y prueba automatizada de navegación. **No** acredita todavía una auditoría WCAG completa, objetivos Web Vitals medidos ni prueba manual en teléfono. Cambios funcionales y backend quedan fuera de alcance.
