"""Open Location Code (Plus Codes) — implementação pura, sem dependências.

Cobre codificação, decodificação, encurtamento e recuperação de códigos
curtos por proximidade, conforme a especificação pública do formato:
https://github.com/google/open-location-code/blob/main/docs/olc_definition.adoc
"""

from __future__ import annotations

from dataclasses import dataclass

CODE_ALPHABET = "23456789CFGHJMPQRVWX"
ENCODING_BASE = len(CODE_ALPHABET)  # 20
LATITUDE_MAX = 90.0
LONGITUDE_MAX = 180.0
PAIR_CODE_LENGTH = 10
PAIR_RESOLUTIONS = [20.0, 1.0, 0.05, 0.0025, 0.000125]
GRID_ROWS = 5
GRID_COLUMNS = 4
GRID_SIZE_DEGREES = 0.000125
SEPARATOR = "+"
SEPARATOR_POSITION = 8
PADDING_CHARACTER = "0"
MAX_CODE_LENGTH = 15
MIN_TRIMMABLE_CODE_LENGTH = 6

# Metros por grau de latitude (esfera média) — suficiente para precisão estimada.
METERS_PER_DEGREE = 111_320.0


class InvalidPlusCode(ValueError):
    """Código Plus Code malformado ou com caracteres inválidos."""


@dataclass(frozen=True)
class CodeArea:
    latitude_lo: float
    longitude_lo: float
    latitude_hi: float
    longitude_hi: float
    code_length: int

    @property
    def latitude_center(self) -> float:
        return (self.latitude_lo + self.latitude_hi) / 2

    @property
    def longitude_center(self) -> float:
        return (self.longitude_lo + self.longitude_hi) / 2

    @property
    def precision_m(self) -> float:
        """Precisão aproximada (maior lado da célula, em metros)."""
        return max(
            (self.latitude_hi - self.latitude_lo) * METERS_PER_DEGREE,
            (self.longitude_hi - self.longitude_lo) * METERS_PER_DEGREE,
        )


def _latitude_precision(code_length: int) -> float:
    """Precisão final em graus para um código com `code_length` dígitos."""
    if code_length <= PAIR_CODE_LENGTH:
        return PAIR_RESOLUTIONS[min(code_length, PAIR_CODE_LENGTH) // 2 - 1]
    return GRID_SIZE_DEGREES / (GRID_ROWS ** (code_length - PAIR_CODE_LENGTH))


def clip_latitude(latitude: float) -> float:
    return min(LATITUDE_MAX, max(-LATITUDE_MAX, latitude))


def normalize_longitude(longitude: float) -> float:
    while longitude < -LONGITUDE_MAX:
        longitude += 2 * LONGITUDE_MAX
    while longitude >= LONGITUDE_MAX:
        longitude -= 2 * LONGITUDE_MAX
    return longitude


def encode(latitude: float, longitude: float, code_length: int = PAIR_CODE_LENGTH) -> str:
    """Codifica uma coordenada em Plus Code (padrão: 10 dígitos + separador)."""
    if code_length < 2 or (code_length < SEPARATOR_POSITION and code_length % 2 == 1):
        raise InvalidPlusCode(f"Comprimento de código inválido: {code_length}")
    code_length = min(code_length, MAX_CODE_LENGTH)

    latitude = min(
        clip_latitude(latitude), LATITUDE_MAX - _latitude_precision(code_length)
    )
    longitude = normalize_longitude(longitude)

    lat = latitude + LATITUDE_MAX
    lng = longitude + LONGITUDE_MAX
    digits = ""

    # Seção de pares (2, 4, 6, 8 ou 10 dígitos).
    for i in range(min(code_length, PAIR_CODE_LENGTH) // 2):
        res = PAIR_RESOLUTIONS[i]
        lat_digit = int(lat / res)
        lng_digit = int(lng / res)
        digits += CODE_ALPHABET[lat_digit] + CODE_ALPHABET[lng_digit]
        lat -= lat_digit * res
        lng -= lng_digit * res

    # Seção de grade (refino além de 10 dígitos, grade 5x4).
    if code_length > PAIR_CODE_LENGTH:
        lat_res = GRID_SIZE_DEGREES
        lng_res = GRID_SIZE_DEGREES
        for _ in range(code_length - PAIR_CODE_LENGTH):
            lat_res /= GRID_ROWS
            lng_res /= GRID_COLUMNS
            row = int(lat / lat_res)
            col = int(lng / lng_res)
            digits += CODE_ALPHABET[row * GRID_COLUMNS + col]
            lat -= row * lat_res
            lng -= col * lng_res

    # Padding até a posição do separador e inserção do '+'.
    if len(digits) < SEPARATOR_POSITION:
        digits = digits.ljust(SEPARATOR_POSITION, PADDING_CHARACTER)
    code = digits[:SEPARATOR_POSITION] + SEPARATOR + digits[SEPARATOR_POSITION:]
    # Convenção: remover padding redundante antes do separador ("588M0000+" → "588M+").
    head, _, tail = code.partition(SEPARATOR)
    return head.rstrip(PADDING_CHARACTER) + SEPARATOR + tail


def _clean(code: str) -> tuple[str, str]:
    """Valida e separa o código em (dígitos_antes, dígitos_depois) do separador."""
    code = code.strip().upper()
    if SEPARATOR not in code:
        raise InvalidPlusCode(f"Separador '{SEPARATOR}' ausente: {code!r}")
    if code.count(SEPARATOR) > 1:
        raise InvalidPlusCode(f"Mais de um separador em: {code!r}")
    before, after = code.split(SEPARATOR)
    if PADDING_CHARACTER in before:
        pad_at = before.index(PADDING_CHARACTER)
        if any(c != PADDING_CHARACTER for c in before[pad_at:]):
            raise InvalidPlusCode(f"Padding em posição inválida: {code!r}")
        before = before[:pad_at]
    digits = before + after
    if not digits or any(c not in CODE_ALPHABET for c in digits):
        raise InvalidPlusCode(f"Caracteres inválidos em: {code!r}")
    if len(before) % 2 == 1:
        raise InvalidPlusCode(f"Dígitos ímpares antes do separador: {code!r}")
    return before, after


def decode(code: str) -> CodeArea:
    """Decodifica um Plus Code completo (ou encurtado) para sua área."""
    before, after = _clean(code)
    digits = before + after
    if len(digits) > MAX_CODE_LENGTH:
        raise InvalidPlusCode(f"Código longo demais: {code!r}")

    lat = 0.0
    lng = 0.0
    pair_len = min(len(digits), PAIR_CODE_LENGTH)
    for i in range(pair_len // 2):
        res = PAIR_RESOLUTIONS[i]
        lat += CODE_ALPHABET.index(digits[2 * i]) * res
        lng += CODE_ALPHABET.index(digits[2 * i + 1]) * res

    lat_res = PAIR_RESOLUTIONS[pair_len // 2 - 1]
    lng_res = lat_res

    if len(digits) > PAIR_CODE_LENGTH:
        lat_res = GRID_SIZE_DEGREES
        lng_res = GRID_SIZE_DEGREES
        for d in digits[PAIR_CODE_LENGTH:]:
            lat_res /= GRID_ROWS
            lng_res /= GRID_COLUMNS
            value = CODE_ALPHABET.index(d)
            row, col = divmod(value, GRID_COLUMNS)
            lat += row * lat_res
            lng += col * lng_res

    return CodeArea(
        latitude_lo=lat - LATITUDE_MAX,
        longitude_lo=lng - LONGITUDE_MAX,
        latitude_hi=lat - LATITUDE_MAX + lat_res,
        longitude_hi=lng - LONGITUDE_MAX + lng_res,
        code_length=len(digits),
    )


def is_full(code: str) -> bool:
    try:
        before, _ = _clean(code)
    except InvalidPlusCode:
        return False
    return len(before) >= SEPARATOR_POSITION


def is_short(code: str) -> bool:
    try:
        before, _ = _clean(code)
    except InvalidPlusCode:
        return False
    return 0 < len(before) < SEPARATOR_POSITION


def shorten(code: str, latitude: float, longitude: float) -> str:
    """Encurta um código completo com base na proximidade de uma referência.

    Remove 4, 6 ou 8 dígitos iniciais quando a recuperação por proximidade
    é garantidamente inequívoca (referência a menos de meia célula do centro).
    """
    if not is_full(code):
        raise InvalidPlusCode("Só é possível encurtar códigos completos")
    area = decode(code)
    if area.code_length < MIN_TRIMMABLE_CODE_LENGTH:
        raise InvalidPlusCode("Código curto demais para encurtar")
    diff = max(
        abs(latitude - area.latitude_center),
        abs(longitude - area.longitude_center),
    )
    # Limiares: metade da resolução coberta pelo prefixo removido.
    if diff < PAIR_RESOLUTIONS[3] / 2:      # remove 8 dígitos
        remove = 8
    elif diff < PAIR_RESOLUTIONS[2] / 2:    # remove 6 dígitos
        remove = 6
    elif diff < PAIR_RESOLUTIONS[1] / 2:    # remove 4 dígitos
        remove = 4
    else:
        return code
    digits = code.replace(SEPARATOR, "")
    trimmed = digits[remove:]
    return trimmed[:SEPARATOR_POSITION] + SEPARATOR + trimmed[SEPARATOR_POSITION:] \
        if len(trimmed) > SEPARATOR_POSITION else trimmed + SEPARATOR


def recover_nearest(short_code: str, ref_latitude: float, ref_longitude: float) -> str:
    """Recupera o código completo mais próximo da referência para um código curto."""
    if is_full(short_code):
        return short_code.strip().upper()
    if not is_short(short_code):
        raise InvalidPlusCode(f"Código curto inválido: {short_code!r}")

    before, after = _clean(short_code)
    removed = PAIR_CODE_LENGTH - len(before)
    if removed % 2 == 1 or removed < 2:
        raise InvalidPlusCode(f"Código curto inválido: {short_code!r}")

    ref_latitude = clip_latitude(ref_latitude)
    ref_longitude = normalize_longitude(ref_longitude)

    # Reaproveita o prefixo da própria referência codificada.
    ref_digits = encode(ref_latitude, ref_longitude).replace(SEPARATOR, "")
    digits = ref_digits[:removed] + before + after
    if len(digits) < SEPARATOR_POSITION:
        digits = digits.ljust(SEPARATOR_POSITION, PADDING_CHARACTER)
    recovered = digits[:SEPARATOR_POSITION] + SEPARATOR + digits[SEPARATOR_POSITION:]

    area = decode(recovered)
    resolution = PAIR_RESOLUTIONS[removed // 2 - 1]
    half = resolution / 2.0

    lat_c = area.latitude_center
    lng_c = area.longitude_center
    # Ajusta de uma célula quando o centro recuperado cai na célula adjacente.
    if ref_latitude + half < lat_c and lat_c - resolution >= -LATITUDE_MAX:
        lat_c -= resolution
    elif ref_latitude - half > lat_c and lat_c + resolution <= LATITUDE_MAX:
        lat_c += resolution
    if ref_longitude + half < lng_c:
        lng_c -= resolution
    elif ref_longitude - half > lng_c:
        lng_c += resolution

    return encode(lat_c, lng_c, area.code_length)
