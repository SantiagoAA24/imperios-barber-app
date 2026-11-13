"""user.must_change_password (clave temporal que el barbero debe cambiar)

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-13 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column(
            "must_change_password", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_column("user", "must_change_password")
