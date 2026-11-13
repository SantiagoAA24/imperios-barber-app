"""Escribe el OpenAPI de la API en apps/web/openapi.json (fuente de los tipos del cliente).

Uso: ``uv run python -m app.export_openapi``. No necesita base de datos ni secretos reales.
"""

import json
import os
from pathlib import Path

# El esquema no depende de la configuración: se fija un secreto de relleno para que el script
# funcione igual en local, en el CI y con cualquier .env (las variables de entorno mandan sobre él).
os.environ["JWT_SECRET"] = "solo-para-exportar-openapi-0123456789abcdef"

from app.main import create_app  # noqa: E402

OUTPUT = Path(__file__).resolve().parents[3] / "apps" / "web" / "openapi.json"


def main() -> None:
    schema = create_app().openapi()
    OUTPUT.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"OpenAPI escrito en {OUTPUT.relative_to(OUTPUT.parents[2])}")


if __name__ == "__main__":
    main()
