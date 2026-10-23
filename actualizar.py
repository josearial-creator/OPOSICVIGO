import requests
from bs4 import BeautifulSoup
import json
import re
from datetime import datetime

URL = "https://sede.vigo.org/expedientes/oposicions/buscador_plazas.jsp?lang=es"

ESTADOS_ACTIVOS = [
    "En fase de presentación de solicitudes",
    "Pendiente de abrir plazo para presentar instancias",
    "Revisión de solicitudes",
    "En fase de realización de pruebas selectivas",
    "En fase de baremación de méritos",
    "Pendiente la constitución del tribunal",
    "Convocada"
]

TIPOS_NO_INTERESAN = [
    "Promoción interna",
    "Concurso Traslados",
    "Concurso específico",
    "Comisión servicios"
]

PALABRAS_INTERES = [
    "administrativ",
    "auxiliar administr",
    "subaltern",
    "ordenanza",
    "biblioteca"
]


def limpiar(texto):
    return " ".join(texto.split())


def obtener_vigo():

    print("Consultando Concello de Vigo...")

    r = requests.get(
        URL,
        timeout=30,
        headers={"User-Agent": "Mozilla/5.0"}
    )

    r.raise_for_status()

    soup = BeautifulSoup(r.text, "html.parser")

    lineas = []

    for texto in soup.stripped_strings:
        texto = limpiar(texto)

        if texto:
            lineas.append(texto)

    resultados = []

    i = 0

    while i < len(lineas):

        # Buscar grupos C1, C2, A1, A2, etc.
        if not re.fullmatch(r"\([A-Z0-9/]+\)", lineas[i]):
            i += 1
            continue

        grupo = lineas[i]

        if i == 0:
            i += 1
            continue

        puesto = lineas[i - 1]

        bloque = lineas[i + 1:i + 8]

        texto_bloque = " | ".join(bloque)

        # Número de plazas
        m = re.search(
            r"N[ºo]\s*plazas:\s*(\d+)",
            texto_bloque,
            re.IGNORECASE
        )

        if not m:
            i += 1
            continue

        plazas = int(m.group(1))

        # Tipo de acceso
        tipo = ""

        for t in [
            "Turno libre",
            "Funcionario de Carrera",
            "Laboral Fijo",
            "Promoción interna",
            "Promoción interna. Reserva personas con discapacidad",
            "Comisión servicios",
            "Concurso Traslados",
            "Concurso específico"
        ]:

            if t.lower() in texto_bloque.lower():
                tipo = t
                break

        # Estado
        estado = ""

        for e in ESTADOS_ACTIVOS + [
            "Finalizado el proceso selectivo"
        ]:

            if e.lower() in texto_bloque.lower():
                estado = e
                break

        # Eliminar FINALIZADOS
        if estado == "Finalizado el proceso selectivo":
            i += 1
            continue

        # Si no podemos determinar el estado, no lo mostramos
        if not estado:
            i += 1
            continue

        # Detectar discapacidad
        discapacidad = (
            "Si"
            if "discapacidad" in texto_bloque.lower()
            or "discapacidad" in puesto.lower()
            else "No"
        )

        # Detectar procesos que NO son de acceso libre
        tipo_lower = tipo.lower()

        es_promocion = "promoción interna" in tipo_lower
        es_traslado = "concurso traslados" in tipo_lower
        es_comision = "comisión servicios" in tipo_lower
        es_concurso = "concurso específico" in tipo_lower

        # Los procesos internos no nos interesan
        if es_promocion:
            i += 1
            continue

        if es_traslado:
            i += 1
            continue

        if es_comision:
            i += 1
            continue

        if es_concurso:
            i += 1
            continue

        # Puesto relevante
        texto_interes = (
            puesto + " " +
            grupo + " " +
            texto_bloque
        ).lower()

        es_administrativo = any(
            palabra in texto_interes
            for palabra in PALABRAS_INTERES
        )

        es_turno_libre = (
            tipo_lower == "turno libre"
        )

        # Solo guardamos:
        # 1. administrativos/auxiliares relevantes
        # 2. turno libre
        # 3. discapacidad
        if not (
            es_administrativo
            or es_turno_libre
            or discapacidad == "Si"
        ):
            i += 1
            continue

        # Prioridad
        if discapacidad == "Si":
            prioridad = "Alta"

        elif es_administrativo and es_turno_libre:
            prioridad = "Alta"

        elif es_administrativo:
            prioridad = "Alta"

        elif es_turno_libre:
            prioridad = "Media"

        else:
            prioridad = "Baja"

        resultados.append({
            "puesto": puesto,
            "grupo": grupo.replace("(", "").replace(")", ""),
            "organismo": "Concello de Vigo",
            "ubicacion": "Vigo",
            "plazas": plazas,
            "tipo": tipo,
            "estado": estado,
            "discapacidad": discapacidad,
            "prioridad": prioridad,
            "fuente": URL
        })

        i += 1

    # Eliminar duplicados
    unicos = {}

    for x in resultados:

        clave = (
            x["puesto"],
            x["grupo"],
            x["plazas"],
            x["tipo"],
            x["estado"]
        )

        unicos[clave] = x

    resultados = list(unicos.values())

    # Orden:
    # Alta -> Media -> Baja
    orden = {
        "Alta": 0,
        "Media": 1,
        "Baja": 2
    }

    resultados.sort(
        key=lambda x: (
            orden.get(x["prioridad"], 9),
            x["puesto"]
        )
    )

    return resultados


def guardar(resultados):

    datos = {
        "actualizado": datetime.now().strftime(
            "%d/%m/%Y %H:%M"
        ),
        "fuentes": [
            {
                "nombre": "Concello de Vigo",
                "url": URL
            }
        ],
        "oposiciones": resultados
    }

    with open(
        "oposiciones.json",
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            datos,
            f,
            ensure_ascii=False,
            indent=2
        )

    print()
    print("========================================")
    print(" PANEL DE VIGO ACTUALIZADO")
    print("========================================")
    print(f"Resultados relevantes: {len(resultados)}")
    print()

    for x in resultados:

        print(
            f"- {x['puesto']} "
            f"({x['grupo']}) | "
            f"{x['plazas']} plazas | "
            f"{x['tipo']} | "
            f"{x['estado']} | "
            f"Discapacidad: {x['discapacidad']} | "
            f"Prioridad: {x['prioridad']}"
        )

    print()
    print("Archivo generado: oposiciones.json")


if __name__ == "__main__":

    try:
        resultados = obtener_vigo()
        guardar(resultados)

    except Exception as e:

        print()
        print("ERROR:")
        print(e)
        print()
