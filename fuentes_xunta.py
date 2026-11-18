"""Catálogo conservador de procesos Xunta verificados en fuentes oficiales.

No inferir que una OEP equivale a plazo abierto: cada entrada mantiene identidad
estable y fuente DOG. Las fechas y situaciones se revisan al incorporar nuevos
anuncios oficiales; la interfaz cierra automáticamente los plazos vencidos.
"""
from copy import deepcopy

OEP_2026 = "https://www.xunta.gal/dog/Publicados/2026/20260508/AnuncioG0597-040526-0004_es.html"
DOG_SUBALTERNO = "https://www.xunta.gal/dog/Publicados/2026/20261030/AnuncioG0597-261026-0001_gl.html"
DOG_AUX_DI = "https://www.xunta.gal/dog/Publicados/2026/20261106/AnuncioG0597-301026-0009_es.html"
PORTAL = "https://www.xunta.gal/es/funcion-publica/procesos-selectivos/consulta"
FECHA_VERIFICACION = "2026-11-18"

# Las OEP aún sin convocatoria individual confirmada se distinguen de las
# convocatorias de otras OEP y de los turnos con reserva intelectual.
CATALOGO = [
    {
        "convocatoria_id": "xunta-oep2026-c1-libre",
        "puesto": "Administrativo · Cuerpo administrativo (OEP 2026)",
        "grupo": "C1", "plazas": 55, "discapacidad_general": 5,
        "discapacidad_intelectual": 0, "tipo": "Acceso libre",
        "estado": "OEP 2026 aprobada · pendiente de convocatoria individual",
        "inscripcion": "No convocada",
        "fuente": OEP_2026,
        "detalle_estado": "55 plazas de acceso libre ofertadas (50 general y 5 reserva general). La OEP no abre el plazo de solicitudes. Comprobar publicaciones posteriores en Función Pública.",
        "prioridad": "Alta"
    },
    {
        "convocatoria_id": "xunta-oep2026-c2-libre-general",
        "puesto": "Auxiliar administrativo · Cuerpo auxiliar (OEP 2026, turnos general y discapacidad general)",
        "grupo": "C2", "plazas": 64, "discapacidad_general": 10,
        "discapacidad_intelectual": 0, "tipo": "Acceso libre",
        "estado": "OEP 2026 aprobada · pendiente de convocatoria individual",
        "inscripcion": "No convocada",
        "fuente": OEP_2026,
        "detalle_estado": "54 plazas de turno general y 10 de discapacidad general en la OEP 2026. Las otras 7 plazas reservadas a discapacidad intelectual se tramitan en una convocatoria separada (10 plazas sumando OEP 2025).",
        "prioridad": "Alta"
    },
    {
        "convocatoria_id": "xunta-subalterno-2026-10-30-libre",
        "puesto": "Personal subalterno · convocatoria 2026 (OEP 2025+2026)",
        "grupo": "AP", "plazas": 72, "plazas_totales": 96,
        "discapacidad_general": 11, "discapacidad_intelectual": 0,
        "tipo": "Acceso libre y reserva general (72 de 96 plazas; 24 promoción interna)",
        "estado": "En fase de presentación de solicitudes", "inscripcion": "Abierta",
        "inicio": "2026-11-02", "fin": "2026-11-27",
        "fuente": DOG_SUBALTERNO, "fuente_detalle": DOG_SUBALTERNO,
        "detalle_estado": "DOG 208 de 30/10/2026. 96 plazas en total, 24 de promoción interna y 72 restantes de acceso libre; 11 reservadas por discapacidad general dentro de la convocatoria.",
        "prioridad": "Alta"
    },
    {
        "convocatoria_id": "xunta-auxiliar-c2-di-2026-11-06",
        "puesto": "Auxiliar administrativo C2 · turno exclusivo discapacidad intelectual",
        "grupo": "C2", "plazas": 10, "discapacidad_general": 0,
        "discapacidad_intelectual": 10, "tipo": "Acceso libre · solo discapacidad intelectual",
        "estado": "En fase de presentación de solicitudes", "inscripcion": "Abierta",
        "inicio": "2026-11-09", "fin": "2026-12-04",
        "fuente": DOG_AUX_DI, "fuente_detalle": DOG_AUX_DI,
        "detalle_estado": "Proceso específico de discapacidad intelectual (DOG 213, 06/11/2026); no equivale al turno de discapacidad general.",
        "prioridad": "Media"
    }
]


def obtener_xunta():
    """Devuelve solo fichas con publicación oficial identificada.

    La revisión manual del DOG y del portal de Función Pública debe actualizar
    el catálogo al publicarse nuevas resoluciones; no se inventan cambios.
    """
    records = []
    for item in CATALOGO:
        record = deepcopy(item)
        record.update({
            "organismo": "Xunta de Galicia",
            "ubicacion": "Galicia (destino por adjudicar)",
            "anio": 2026,
            "discapacidad": "Si" if record["discapacidad_general"] else "No",
            "fuente_seguimiento": PORTAL,
            "verificado_el": FECHA_VERIFICACION
        })
        records.append(record)
    return records
