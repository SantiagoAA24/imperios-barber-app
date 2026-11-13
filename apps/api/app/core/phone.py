"""Normalización de celulares colombianos a E.164."""

import re

INVALID_PHONE_MESSAGE = "Escribe un celular colombiano de 10 dígitos"

_SEPARATORS = re.compile(r"[\s\-().]")
_NATIONAL = re.compile(r"3\d{9}")  # los móviles colombianos empiezan por 3


class InvalidPhoneError(ValueError):
    """El texto no es un celular colombiano válido."""


def normalize_phone(raw: str) -> str:
    """'300 123 4567', '3001234567', '+57 300 123 4567' o '573001234567' -> '+573001234567'."""
    text = _SEPARATORS.sub("", raw)
    if text.startswith("+"):
        if not text.startswith("+57"):
            raise InvalidPhoneError(raw)
        digits = text[3:]
    else:
        digits = text
        if len(digits) == 12 and digits.startswith("57"):
            digits = digits[2:]
    if not digits.isascii() or not _NATIONAL.fullmatch(digits):
        raise InvalidPhoneError(raw)
    return f"+57{digits}"
