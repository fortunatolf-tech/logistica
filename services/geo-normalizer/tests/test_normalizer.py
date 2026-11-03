import base64
import io
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from PIL import Image  # noqa: E402

from app import pluscode  # noqa: E402
from app.geocoder import GeocodeResult, StaticProvider  # noqa: E402
from app.normalizer import (  # noqa: E402
    InMemoryLocationRepository,
    NormalizeError,
    NormalizeRequest,
    normalize,
)
from app.validation import BoundingBox  # noqa: E402

SP = (-23.55052, -46.633308)
BBOX_BRASIL = BoundingBox(min_lng=-73.99, min_lat=-33.75, max_lng=-28.84, max_lat=5.27)


def _foto_sp_base64() -> str:
    img = Image.new("RGB", (8, 8), (30, 90, 160))
    exif = Image.Exif()
    exif[0x8825] = {
        1: "S", 2: (23.0, 33.0, 1.9),
        3: "W", 4: (46.0, 37.0, 59.9),
    }
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _provider() -> StaticProvider:
    return StaticProvider(
        {
            "praça da sé, são paulo": GeocodeResult(
                lat=SP[0], lng=SP[1], precisao_m=25.0,
                endereco_formatado="Praça da Sé, São Paulo, SP",
                provedor="static",
            )
        }
    )


class TestNormalizeGps(unittest.TestCase):
    def setUp(self):
        self.repo = InMemoryLocationRepository()

    def test_gps_valido(self):
        loc = normalize(
            NormalizeRequest(fonte="gps", lat=SP[0], lng=SP[1], precisao_m=8.0,
                             operador="entregador-1", tenant_id="t1"),
            _provider(), repo=self.repo, bbox=BBOX_BRASIL,
        )
        self.assertTrue(loc.validado)
        self.assertEqual(loc.fonte, "gps")
        self.assertAlmostEqual(loc.lat, SP[0], places=6)
        self.assertEqual(loc.precisao_m, 8.0)
        # plus_code_equivalente decodifica de volta para o ponto
        area = pluscode.decode(loc.plus_code_equivalente)
        self.assertLessEqual(area.latitude_lo, SP[0])
        self.assertGreaterEqual(area.latitude_hi, SP[0])
        # trilha de auditoria persistida
        self.assertEqual(len(self.repo.registros), 1)
        tenant, salvo = self.repo.registros[0]
        self.assertEqual(tenant, "t1")
        self.assertEqual(salvo.auditoria[0].quem, "entregador-1")

    def test_gps_fora_da_area_operacao(self):
        with self.assertRaises(NormalizeError) as ctx:
            normalize(
                NormalizeRequest(fonte="gps", lat=48.8567, lng=2.3511),
                _provider(), bbox=BBOX_BRASIL,
            )
        self.assertEqual(ctx.exception.motivo, "fora_da_area_operacao")

    def test_gps_precisao_insuficiente(self):
        with self.assertRaises(NormalizeError) as ctx:
            normalize(
                NormalizeRequest(fonte="gps", lat=SP[0], lng=SP[1], precisao_m=5000.0),
                _provider(), bbox=BBOX_BRASIL,
            )
        self.assertEqual(ctx.exception.motivo, "precisao_insuficiente")

    def test_gps_coordenada_impossivel(self):
        with self.assertRaises(NormalizeError) as ctx:
            normalize(
                NormalizeRequest(fonte="gps", lat=123.0, lng=SP[1]),
                _provider(), bbox=BBOX_BRASIL,
            )
        self.assertEqual(ctx.exception.motivo, "coordenada_invalida")


class TestNormalizeExif(unittest.TestCase):
    def test_exif_valido(self):
        loc = normalize(
            NormalizeRequest(fonte="exif", foto_base64=_foto_sp_base64()),
            _provider(), bbox=BBOX_BRASIL,
        )
        self.assertAlmostEqual(loc.lat, SP[0], places=3)
        self.assertAlmostEqual(loc.lng, SP[1], places=3)
        self.assertEqual(loc.fonte, "exif")

    def test_exif_sem_geotag(self):
        img = Image.new("RGB", (8, 8))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        with self.assertRaises(NormalizeError) as ctx:
            normalize(
                NormalizeRequest(fonte="exif",
                                 foto_base64=base64.b64encode(buf.getvalue()).decode()),
                _provider(), bbox=BBOX_BRASIL,
            )
        self.assertEqual(ctx.exception.motivo, "sem_geotag")


class TestNormalizePlusCode(unittest.TestCase):
    def test_plus_code_completo(self):
        codigo = pluscode.encode(*SP)
        loc = normalize(
            NormalizeRequest(fonte="plus_code", plus_code=codigo),
            _provider(), bbox=BBOX_BRASIL,
        )
        self.assertAlmostEqual(loc.lat, SP[0], places=4)
        self.assertAlmostEqual(loc.lng, SP[1], places=4)
        self.assertLess(loc.precisao_m, 20.0)

    def test_plus_code_curto_com_referencia(self):
        codigo = pluscode.encode(*SP)
        curto = pluscode.shorten(codigo, *SP)
        loc = normalize(
            NormalizeRequest(fonte="plus_code", plus_code=curto,
                             referencia_lat=SP[0], referencia_lng=SP[1]),
            _provider(), bbox=BBOX_BRASIL,
        )
        self.assertAlmostEqual(loc.lat, SP[0], places=4)
        self.assertAlmostEqual(loc.lng, SP[1], places=4)

    def test_plus_code_curto_sem_referencia(self):
        codigo = pluscode.encode(*SP)
        curto = pluscode.shorten(codigo, *SP)
        with self.assertRaises(NormalizeError) as ctx:
            normalize(
                NormalizeRequest(fonte="plus_code", plus_code=curto),
                _provider(), bbox=BBOX_BRASIL,
            )
        self.assertEqual(ctx.exception.motivo, "referencia_ausente")

    def test_plus_code_invalido(self):
        with self.assertRaises(NormalizeError) as ctx:
            normalize(
                NormalizeRequest(fonte="plus_code", plus_code="XXXX+XX!!"),
                _provider(), bbox=BBOX_BRASIL,
            )
        self.assertEqual(ctx.exception.motivo, "plus_code_invalido")


class TestNormalizeEndereco(unittest.TestCase):
    def test_endereco_geocodificado(self):
        loc = normalize(
            NormalizeRequest(fonte="endereco", endereco="Praça da Sé, São Paulo"),
            _provider(), bbox=BBOX_BRASIL,
        )
        self.assertAlmostEqual(loc.lat, SP[0], places=6)
        self.assertEqual(loc.fonte, "endereco")

    def test_fallback_para_plus_code_quando_endereco_falha(self):
        codigo = pluscode.encode(*SP)
        loc = normalize(
            NormalizeRequest(fonte="endereco",
                             endereco="endereço inexistente 9999",
                             plus_code=codigo),
            _provider(), bbox=BBOX_BRASIL,
        )
        self.assertAlmostEqual(loc.lat, SP[0], places=4)

    def test_endereco_nao_encontrado_sem_fallback(self):
        with self.assertRaises(NormalizeError) as ctx:
            normalize(
                NormalizeRequest(fonte="endereco", endereco="endereço inexistente 9999"),
                _provider(), bbox=BBOX_BRASIL,
            )
        self.assertEqual(ctx.exception.motivo, "endereco_nao_encontrado")


class TestFonteInvalida(unittest.TestCase):
    def test_fonte_desconhecida(self):
        with self.assertRaises(NormalizeError) as ctx:
            normalize(NormalizeRequest(fonte="pombo-correio"), _provider())
        self.assertEqual(ctx.exception.motivo, "fonte_invalida")


if __name__ == "__main__":
    unittest.main()
