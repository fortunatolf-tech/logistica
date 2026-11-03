import io
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from PIL import Image  # noqa: E402

from app.exif_extract import (  # noqa: E402
    DEFAULT_GPS_PRECISION_M,
    GeoTagNotFound,
    extract_gps,
)

GPS_IFD = 0x8825


def _jpeg_com_gps(lat_dms, lat_ref, lng_dms, lng_ref) -> bytes:
    """Gera um JPEG mínimo com geotag EXIF para uso como fixture."""
    img = Image.new("RGB", (8, 8), (30, 90, 160))
    exif = Image.Exif()
    exif[GPS_IFD] = {
        1: lat_ref,   # GPSLatitudeRef
        2: lat_dms,   # GPSLatitude (graus, minutos, segundos)
        3: lng_ref,   # GPSLongitudeRef
        4: lng_dms,   # GPSLongitude
    }
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


def _jpeg_sem_gps() -> bytes:
    img = Image.new("RGB", (8, 8), (200, 30, 30))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


class TestExifExtract(unittest.TestCase):
    def test_extrai_geotag_sao_paulo(self):
        # 23°33'1.9"S 46°37'59.9"W ≈ (-23.5505, -46.6333)
        foto = _jpeg_com_gps(
            (23.0, 33.0, 1.9), "S",
            (46.0, 37.0, 59.9), "W",
        )
        r = extract_gps(foto)
        self.assertAlmostEqual(r.lat, -23.5505, places=3)
        self.assertAlmostEqual(r.lng, -46.6333, places=3)
        self.assertEqual(r.precisao_m, DEFAULT_GPS_PRECISION_M)

    def test_hemisferios_norte_leste(self):
        # 48°51'24"N 2°21'4"E ≈ Paris
        foto = _jpeg_com_gps(
            (48.0, 51.0, 24.0), "N",
            (2.0, 21.0, 4.0), "E",
        )
        r = extract_gps(foto)
        self.assertAlmostEqual(r.lat, 48.8567, places=3)
        self.assertAlmostEqual(r.lng, 2.3511, places=3)

    def test_sem_geotag_levanta_erro_estruturado(self):
        with self.assertRaises(GeoTagNotFound):
            extract_gps(_jpeg_sem_gps())

    def test_bytes_invalidos(self):
        with self.assertRaises(ValueError):
            extract_gps(b"isso nao e uma imagem")


if __name__ == "__main__":
    unittest.main()
