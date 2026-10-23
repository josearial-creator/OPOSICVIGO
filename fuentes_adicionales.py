import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime

URL_SERGAS = "https://extranet.sergas.es/OPEWB/OPE/ListadoCategorias.aspx?Idioma=es"

PALABRAS_SERGAS = [
    "administrativ",
    "celador",
    "telefonista",
    "servicios generales",
    "servizos xerais",
    "informat",
]

def obtener_sergas():
    print("Consultando SERGAS...")

    sesion = requests.Session()
    respuesta = sesion.get(URL_SERGAS, timeout=30)
    respuesta.raise_for_status()
    respuesta.encoding = "utf-8"

    soup = BeautifulSoup(respuesta.text, "html.parser")
    categorias = {}

    for enlace in soup.find_all("a", href=True):
        nombre = enlace.get_text(" ", strip=True)
        if not any(p in nombre.lower() for p in PALABRAS_SERGAS):
            continue

        url = urljoin(respuesta.url, enlace["href"])
        url = url.replace("IdPaxina=&", "")

        if "IdCategoria=" in url:
            categorias[url] = nombre

    print("Categorías SERGAS localizadas:", len(categorias))
    return categorias

def obtener_detalle_sergas(url):
    respuesta = requests.get(url, timeout=30)
    respuesta.raise_for_status()
    respuesta.encoding = "utf-8"

    texto = BeautifulSoup(
        respuesta.text, "html.parser"
    ).get_text(" ", strip=True)

    if "non está dispoñible" in texto.lower():
        raise RuntimeError("Ficha SERGAS no disponible")

    def plazas(campo):
        coincidencia = re.search(
            re.escape(campo) + r"\s*:\s*(\d+)",
            texto,
            re.IGNORECASE
        )
        return int(coincidencia.group(1)) if coincidencia else 0

    return {
        "libre": plazas("Libre"),
        "promocion_interna": plazas("Promoción interna"),
        "discapacidad_general": plazas("Discapacidade xeral"),
        "discapacidad_intelectual": plazas("Discapacidade intelectual"),
    }

def obtener_plazo_sergas(url):
    respuesta = requests.get(url, timeout=30)
    respuesta.raise_for_status()
    respuesta.encoding = "utf-8"

    texto = BeautifulSoup(
        respuesta.text, "html.parser"
    ).get_text(" ", strip=True)

    if "non está dispoñible" in texto.lower():
        raise RuntimeError("Ficha SERGAS no disponible")

    patron = (
        r"Resolución pola que se convoca"
        r".{0,180}?"
        r"(\d{2}/\d{2}/\d{4})\s+"
        r"(\d{2}/\d{2}/\d{4})"
    )

    coincidencia = re.search(patron, texto, re.IGNORECASE)

    if not coincidencia:
        return {"inicio": None, "fin": None, "inscripcion": "Por verificar"}

    fin, inicio = coincidencia.groups()
    hoy = datetime.now().date()
    fecha_inicio = datetime.strptime(inicio, "%d/%m/%Y").date()
    fecha_fin = datetime.strptime(fin, "%d/%m/%Y").date()

    if hoy < fecha_inicio:
        estado = "Pendiente"
    elif hoy <= fecha_fin:
        estado = "Abierta"
    else:
        estado = "Cerrada"

    return {"inicio": inicio, "fin": fin, "inscripcion": estado}
