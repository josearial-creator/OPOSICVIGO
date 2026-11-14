"""Pruebas con HTML sintético: no consultan sitios externos ni datos personales."""
import unittest
from unittest.mock import patch
from types import SimpleNamespace

from actualizar import obtener_vigo


def page(link):
    return f"""<!doctype html><html><body><main>
    <h3><a href="{link}">Auxiliar Administrativo/a</a> (C2)</h3>
    <ul><li>Turno libre</li><li>En fase de presentación de solicitudes</li><li>Nº plazas: 3</li></ul>
    </main></body></html>"""


class FuenteOficialTest(unittest.TestCase):
    def parse(self, html):
        with patch("actualizar.requests.get", return_value=SimpleNamespace(
            text=html, raise_for_status=lambda: None
        )):
            return obtener_vigo()

    def test_ficha_exacta_y_clave_historica(self):
        data = self.parse(page("/expedientes/oposicions/plaza.jsp?id=754&lang=es"))
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["fuente_detalle"],
                         "https://sede.vigo.org/expedientes/oposicions/plaza.jsp?id=754&lang=es")
        self.assertEqual(data[0]["fuente"],
                         "https://sede.vigo.org/expedientes/oposicions/buscador_plazas.jsp?lang=es")
        self.assertNotIn("convocatoria_id", data[0])

    def test_no_inventar_enlaces(self):
        for value in ("https://otro.dominio/plaza.jsp?id=754",
                      "/expedientes/oposicions/plaza.jsp?id=no-verificado",
                      "/expedientes/oposicions/oferta.jsp?id=754",
                      "#"):
            with self.subTest(value=value):
                data=self.parse(page(value))
                self.assertEqual(len(data), 1)
                self.assertNotIn("fuente_detalle", data[0])

    def test_no_confundir_dos_plazas(self):
        html=page("/expedientes/oposicions/plaza.jsp?id=754")
        html=html.replace("</main>", """
        <h3><a href="/expedientes/oposicions/plaza.jsp?id=901">Auxiliar Administrativo/a</a> (C2)</h3>
        <ul><li>Turno libre</li><li>Convocada</li><li>Nº plazas: 5</li></ul></main>""")
        data=self.parse(html)
        self.assertEqual(len(data), 2)
        self.assertEqual({x["plazas"]: x["fuente_detalle"].split("id=")[1] for x in data},
                         {3: "754", 5: "901"})


if __name__ == "__main__":
    unittest.main()
