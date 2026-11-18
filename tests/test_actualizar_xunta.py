"""Contrato del catálogo oficial de la Xunta y reserva de plazas."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fuentes_xunta import obtener_xunta, OEP_2026, DOG_SUBALTERNO, DOG_AUX_DI

class XuntaCatalogoTests(unittest.TestCase):
    def test_identidad_y_fuentes_oficiales(self):
        rows=obtener_xunta()
        self.assertGreaterEqual(len(rows),4)
        self.assertEqual(len({r["convocatoria_id"] for r in rows}),len(rows))
        self.assertTrue(all(r["organismo"]=="Xunta de Galicia" for r in rows))
        self.assertTrue(all(r["fuente"].startswith("https://www.xunta.gal/dog/") for r in rows))
        self.assertTrue(all(r["verificado_el"] for r in rows))
    def test_oep_sin_inscripcion(self):
        rows=[r for r in obtener_xunta() if r["fuente"]==OEP_2026]
        self.assertGreaterEqual(len(rows),2)
        self.assertTrue(all(r["inscripcion"]=="No convocada" for r in rows))
        self.assertTrue(all(not r.get("inicio") and not r.get("fin") for r in rows))
    def test_plazos_y_discapacidad(self):
        rows=obtener_xunta()
        sub=next(r for r in rows if r["fuente"]==DOG_SUBALTERNO)
        self.assertEqual(sub["plazas"],72)
        self.assertEqual(sub["plazas_totales"],96)
        self.assertEqual(sub["discapacidad_general"],11)
        self.assertEqual(sub["fin"],"2026-11-27")
        di=next(r for r in rows if r["fuente"]==DOG_AUX_DI)
        self.assertEqual(di["discapacidad_general"],0)
        self.assertEqual(di["discapacidad_intelectual"],10)
        self.assertEqual(di["tipo"],"Acceso libre · solo discapacidad intelectual")

if __name__=="__main__":
    unittest.main()
