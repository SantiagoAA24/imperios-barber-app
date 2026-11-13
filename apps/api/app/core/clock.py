"""Reloj inyectable: las pruebas lo sustituyen con ``app.dependency_overrides``."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends


def utcnow() -> datetime:
    return datetime.now(UTC)


Now = Annotated[datetime, Depends(utcnow)]
