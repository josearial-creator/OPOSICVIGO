"""Garantías del catálogo público de Rumbo antes de publicar la actualización diaria."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "importar_rumbo.json"
PUBLISHED = ROOT / "docs" / "importar_rumbo.json"
AEAT_OEP_ID = "aeat-oep-2026-agentes-1135h"


def read_feed(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise AssertionError(f"El catálogo debe ser una lista: {path}")
    return data


class FeedIntegrityTests(unittest.TestCase):
    def test_la_copia_publica_coincide_con_el_catalogo_fuente(self):
        source = read_feed(SOURCE)
        published = read_feed(PUBLISHED)
        self.assertEqual(source, published, "La web perdería novedades tras la próxima actualización diaria")
        self.assertEqual(len([r for r in published if r.get("id") == AEAT_OEP_ID]), 1, "La AEAT debe aparecer una sola vez en la web")

    def test_agentes_hacienda_2026_permanece_identificado_y_sin_plazo_inventado(self):
        source = read_feed(SOURCE)
        records = [r for r in source if r.get("id") == AEAT_OEP_ID]
        self.assertEqual(len(records), 1, "Debe mantenerse una ficha única de la OEP 2026")
        r = records[0]
        self.assertEqual(r["organismo"], "Agencia Tributaria (AEAT)")
        self.assertEqual(r["grupo"], "C1")
        self.assertEqual(r["anio"], 2026)
        self.assertEqual(r["plazas"], 1000)
        self.assertEqual(r["discapacidad_general"], 80)
        self.assertEqual(r["inscripcion"], "No convocada")
        self.assertFalse(r.get("inicio") or r.get("fin"), "Una OEP no determina el plazo de inscripción")
        self.assertTrue(r.get("fuente", "").startswith("https://www.boe.es/"))
        self.assertIn("BOE-A-2026-9946", r["fuente"])

    def test_nunca_se_presentan_c2_como_agentes_de_hacienda(self):
        for r in read_feed(SOURCE):
            if "AGENTES DE LA HACIENDA PÚBLICA" in r.get("puesto", "").upper():
                self.assertEqual(r["grupo"], "C1")


if __name__ == "__main__":
    unittest.main()
