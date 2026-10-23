import json
import time
from pathlib import Path
from actualizar import obtener_vigo
from fuentes_adicionales import (
    obtener_sergas, obtener_detalle_sergas, obtener_plazo_sergas
)

base = Path(__file__).resolve().parent
archivo = base / "importar_rumbo.json"
anteriores = json.loads(archivo.read_text(encoding="utf-8"))

vigo_anterior = [x for x in anteriores if x.get("organismo") == "Concello de Vigo"]
sergas = {
    x["fuente"]: x for x in anteriores
    if x.get("organismo") == "SERGAS" and x.get("fuente")
}

try:
    vigo = obtener_vigo()
    if not vigo:
        raise ValueError("Consulta de Vigo vacía")
    print("Vigo actualizado:", len(vigo))
except Exception as e:
    print("Error en Vigo; se conservan datos:", e)
    vigo = vigo_anterior

catalogo_archivo = base / "catalogo_sergas.json"
catalogo_anterior = None
if catalogo_archivo.exists():
    catalogo_anterior = set(json.loads(catalogo_archivo.read_text(encoding="utf-8")))

try:
    categorias = obtener_sergas()
    if not categorias:
        raise ValueError("Catálogo SERGAS vacío")
    for url, nombre in categorias.items():
        try:
            plazo = obtener_plazo_sergas(url)
            estado = plazo["inscripcion"]
            es_nueva = catalogo_anterior is not None and url not in catalogo_anterior

            if estado in ("Abierta", "Pendiente") or es_nueva or url in sergas:
                d = obtener_detalle_sergas(url)
                anterior = sergas.get(url, {})
                estados = {
                    "Abierta": "En fase de presentación de solicitudes",
                    "Pendiente": "Pendiente de abrir plazo",
                    "Cerrada": "Inscripción cerrada",
                    "Por verificar": "Plazo por verificar"
                }
                sergas[url] = {
                    **anterior,
                    "puesto": nombre,
                    "grupo": anterior.get("grupo", "Por verificar"),
                    "organismo": "SERGAS",
                    "ubicacion": "Galicia (destino por adjudicar)",
                    "plazas": d["libre"],
                    "tipo": "Acceso libre",
                    "estado": estados.get(estado, "Plazo por verificar"),
                    "inscripcion": estado,
                    "inicio": plazo["inicio"],
                    "fin": plazo["fin"],
                    "discapacidad_general": d["discapacidad_general"],
                    "discapacidad_intelectual": d["discapacidad_intelectual"],
                    "discapacidad": "Si" if d["discapacidad_general"] > 0 else "No",
                    "prioridad": anterior.get("prioridad", "Media"),
                    "fuente": url
                }
        except Exception as e:
            print("Error en categoría SERGAS:", nombre, str(e)[:120])
        time.sleep(1)

    catalogo_archivo.write_text(
        json.dumps(list(categorias), ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
except Exception as e:
    print("Error en catálogo SERGAS; se conservan datos:", e)

otros = [
    x for x in anteriores
    if x.get("organismo") not in ("Concello de Vigo", "SERGAS")
]
resultado = vigo + list(sergas.values()) + otros
archivo.write_text(
    json.dumps(resultado, ensure_ascii=False, indent=2),
    encoding="utf-8"
)
print("Actualización preparada:", len(resultado), "convocatorias")
