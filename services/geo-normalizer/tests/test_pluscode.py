import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import pluscode  # noqa: E402


class TestEncodeDecode(unittest.TestCase):
    def test_round_trip_contem_ponto_original(self):
        casos = [
            (-23.55052, -46.633308),  # São Paulo
            (37.4220, -122.0841),     # Googleplex
            (-22.9068, -43.1729),     # Rio de Janeiro
            (0.0, 0.0),
            (-33.8688, 151.2093),     # Sydney
        ]
        for lat, lng in casos:
            with self.subTest(lat=lat, lng=lng):
                code = pluscode.encode(lat, lng)
                area = pluscode.decode(code)
                self.assertLessEqual(area.latitude_lo, lat)
                self.assertGreaterEqual(area.latitude_hi, lat)
                self.assertLessEqual(area.longitude_lo, lng)
                self.assertGreaterEqual(area.longitude_hi, lng)

    def test_codigo_conhecido_googleplex(self):
        # "849VCWC8+R9" é o Plus Code público do Googleplex.
        area = pluscode.decode("849VCWC8+R9")
        self.assertAlmostEqual(area.latitude_center, 37.4220, places=3)
        self.assertAlmostEqual(area.longitude_center, -122.0841, places=3)

    def test_formato_padrao_10_digitos(self):
        code = pluscode.encode(-23.55052, -46.633308)
        self.assertEqual(len(code), 11)  # "XXXXXXXX+XX": 10 dígitos + separador
        self.assertEqual(code[8], "+")

    def test_precisao_codigo_completo(self):
        area = pluscode.decode(pluscode.encode(-23.55052, -46.633308))
        # Célula de 10 dígitos: ~14 m de lado.
        self.assertLess(area.precision_m, 20.0)
        self.assertGreater(area.precision_m, 5.0)

    def test_grade_11_digitos_refinaria(self):
        code = pluscode.encode(-23.55052, -46.633308, code_length=11)
        area = pluscode.decode(code)
        self.assertEqual(area.code_length, 11)
        self.assertLess(area.precision_m, 5.0)

    def test_decodifica_minusculo(self):
        area = pluscode.decode("849vcwc8+r9")
        self.assertAlmostEqual(area.latitude_center, 37.4220, places=3)

    def test_codigo_invalido(self):
        for codigo in ("849VCWC8", "849V+CWC8+", "849VCWC8+R!", ""):
            with self.subTest(codigo=codigo):
                with self.assertRaises(pluscode.InvalidPlusCode):
                    pluscode.decode(codigo)


class TestShortenRecover(unittest.TestCase):
    def setUp(self):
        self.lat, self.lng = -23.55052, -46.633308
        self.full = pluscode.encode(self.lat, self.lng)

    def test_shorten_e_recover_round_trip(self):
        curto = pluscode.shorten(self.full, self.lat, self.lng)
        self.assertTrue(pluscode.is_short(curto))
        recuperado = pluscode.recover_nearest(curto, self.lat, self.lng)
        self.assertEqual(recuperado[:8], self.full[:8])

    def test_recupera_a_partir_de_referencia_proxima(self):
        # Código encurtado no próprio ponto (remove 8 dígitos): a recuperação
        # é garantida para referências a menos de 0,00125° (~140 m).
        curto = pluscode.shorten(self.full, self.lat, self.lng)
        recuperado = pluscode.recover_nearest(curto, self.lat + 0.0008, self.lng + 0.0008)
        area = pluscode.decode(recuperado)
        self.assertLessEqual(area.latitude_lo, self.lat)
        self.assertGreaterEqual(area.latitude_hi, self.lat)

    def test_shorten_mais_curto_quando_referencia_e_distante(self):
        # Referência a ~1 km: encurta apenas 6 dígitos (célula de 0,05°),
        # e a recuperação ainda funciona nesse raio.
        ref_lat, ref_lng = self.lat + 0.008, self.lng + 0.008
        curto = pluscode.shorten(self.full, ref_lat, ref_lng)
        before = curto.split("+")[0]
        self.assertEqual(len(before), 4)
        recuperado = pluscode.recover_nearest(curto, ref_lat, ref_lng)
        area = pluscode.decode(recuperado)
        self.assertLessEqual(area.latitude_lo, self.lat)
        self.assertGreaterEqual(area.latitude_hi, self.lat)

    def test_shorten_longe_demais_retorna_completo(self):
        # Referência a >100 km: não há encurtamento seguro.
        resultado = pluscode.shorten(self.full, -22.0, -43.0)
        self.assertEqual(resultado, self.full)

    def test_is_full_e_is_short(self):
        self.assertTrue(pluscode.is_full(self.full))
        self.assertFalse(pluscode.is_short(self.full))
        curto = pluscode.shorten(self.full, self.lat, self.lng)
        self.assertTrue(pluscode.is_short(curto))
        self.assertFalse(pluscode.is_full(curto))


if __name__ == "__main__":
    unittest.main()
