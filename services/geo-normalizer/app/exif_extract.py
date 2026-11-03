"""Extração de geotag EXIF de fotos (JPEG; HEIC quando pillow-heif estiver instalado)."""

from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image

try:  # suporte opcional a HEIC/HEIF
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:  # pragma: no cover - depende de pacote opcional
    pass

GPS_IFD = 0x8825
GPS_LAT_REF = 1
GPS_LAT = 2
GPS_LNG_REF = 3
GPS_LNG = 4
GPS_DOP = 11  # diluição de precisão horizontal, quando presente

# Precisão assumida (m) quando a foto não informa DOP.
DEFAULT_GPS_PRECISION_M = 15.0


class GeoTagNotFound(ValueError):
    """A imagem não contém geotag EXIF."""


@dataclass(frozen=True)
class ExifGeoResult:
    lat: float
    lng: float
    precisao_m: float


def _dms_to_decimal(dms, ref: str) -> float:
    degrees, minutes, seconds = (float(v) for v in dms)
    decimal = degrees + minutes / 60.0 + seconds / 3600.0
    if ref.upper() in ("S", "W"):
        decimal = -decimal
    return decimal


def extract_gps(image_bytes: bytes) -> ExifGeoResult:
    """Extrai (lat, lng, precisão) do EXIF; levanta GeoTagNotFound se ausente."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            exif = img.getexif()
            if not exif:
                raise GeoTagNotFound("Imagem sem dados EXIF")
            try:
                gps = exif.get_ifd(GPS_IFD)
            except Exception as exc:  # IFD ausente ou corrompido
                raise GeoTagNotFound("Imagem sem IFD de GPS no EXIF") from exc
    except GeoTagNotFound:
        raise
    except Exception as exc:
        raise ValueError(f"Não foi possível ler a imagem: {exc}") from exc

    if not gps or GPS_LAT not in gps or GPS_LNG not in gps:
        raise GeoTagNotFound("Imagem sem geotag (lat/lng) no EXIF")

    lat = _dms_to_decimal(gps[GPS_LAT], str(gps.get(GPS_LAT_REF, "N")))
    lng = _dms_to_decimal(gps[GPS_LNG], str(gps.get(GPS_LNG_REF, "E")))

    dop = gps.get(GPS_DOP)
    precisao_m = float(dop) * 5.0 if dop else DEFAULT_GPS_PRECISION_M
    return ExifGeoResult(lat=lat, lng=lng, precisao_m=precisao_m)
