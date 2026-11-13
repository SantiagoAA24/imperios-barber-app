import pytest

from app.core.phone import InvalidPhoneError, normalize_phone


@pytest.mark.parametrize(
    "raw",
    [
        "300 123 4567",
        "3001234567",
        "+57 300 123 4567",
        "573001234567",
        " 300-123-4567 ",
        "(300) 123 4567",
    ],
)
def test_celulares_validos_se_normalizan_a_e164(raw: str) -> None:
    assert normalize_phone(raw) == "+573001234567"


@pytest.mark.parametrize(
    "raw",
    [
        "601 234 5678",  # fijo de Bogotá
        "300 123 456",  # 9 dígitos
        "300 123 45678",  # 11 dígitos
        "300 123 45ab",  # letras
        "abcdefghij",
        "+1 300 123 4567",  # otro país
        "+57 601 234 5678",
        "5730012345",  # 57 + 8 dígitos
        "",
        "   ",
        "٣٠٠١٢٣٤٥٦٧",  # dígitos no ASCII
    ],
)
def test_celulares_invalidos(raw: str) -> None:
    with pytest.raises(InvalidPhoneError):
        normalize_phone(raw)
