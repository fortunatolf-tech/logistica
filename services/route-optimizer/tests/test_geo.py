import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.geo import URBAN_CIRCUITY_FACTOR, build_matrix, haversine_km  # noqa: E402


class TestHaversine(unittest.TestCase):
    def test_distancia_sp_rio(self):
        # São Paulo (-23.5505, -46.6333) → Rio (-22.9068, -43.1729): ~358 km.
        d = haversine_km(-23.5505, -46.6333, -22.9068, -43.1729)
        self.assertAlmostEqual(d, 358, delta=8)

    def test_mesmo_ponto(self):
        self.assertEqual(haversine_km(-23.5, -46.6, -23.5, -46.6), 0.0)

    def test_simetria(self):
        a = haversine_km(-23.5, -46.6, -22.9, -43.1)
        b = haversine_km(-22.9, -43.1, -23.5, -46.6)
        self.assertAlmostEqual(a, b, places=9)


class TestMatrix(unittest.TestCase):
    def test_matriz_simetrica_com_fator_urbano(self):
        pts = [(-23.55, -46.63), (-22.90, -43.17), (-23.96, -46.33)]
        m = build_matrix(pts)
        self.assertEqual(len(m), 3)
        for i in range(3):
            self.assertEqual(m[i][i], 0.0)
            for j in range(3):
                self.assertAlmostEqual(m[i][j], m[j][i], places=9)
        esperado = haversine_km(*pts[0], *pts[1]) * URBAN_CIRCUITY_FACTOR
        self.assertAlmostEqual(m[0][1], esperado, places=9)


if __name__ == "__main__":
    unittest.main()
