"""esquema inicial

Revision ID: 0001
Revises:
Create Date: 2026-11-13 05:26:39.555364

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Esquema inicial. Las exclusiones de solape se escriben a mano (ver ALTER TABLE al final)."""
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.create_table(
        "business",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("domain", sa.String(), nullable=True),
        sa.Column("timezone", sa.String(), server_default="America/Bogota", nullable=False),
        sa.Column("tolerance_min", sa.Integer(), server_default=sa.text("5"), nullable=False),
        sa.Column("slot_min", sa.Integer(), server_default=sa.text("30"), nullable=False),
        sa.Column("min_lead_min", sa.Integer(), server_default=sa.text("30"), nullable=False),
        sa.Column(
            "cancel_min_notice_min", sa.Integer(), server_default=sa.text("60"), nullable=False
        ),
        sa.Column(
            "max_active_per_phone", sa.Integer(), server_default=sa.text("3"), nullable=False
        ),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "cancel_min_notice_min >= 0", name=op.f("ck_business_cancel_min_notice_non_negative")
        ),
        sa.CheckConstraint(
            "max_active_per_phone > 0", name=op.f("ck_business_max_active_per_phone_positive")
        ),
        sa.CheckConstraint("min_lead_min >= 0", name=op.f("ck_business_min_lead_min_non_negative")),
        sa.CheckConstraint("slot_min > 0", name=op.f("ck_business_slot_min_positive")),
        sa.CheckConstraint(
            "tolerance_min >= 0", name=op.f("ck_business_tolerance_min_non_negative")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_business")),
        sa.UniqueConstraint("domain", name=op.f("uq_business_domain")),
        sa.UniqueConstraint("slug", name=op.f("uq_business_slug")),
    )
    op.create_table(
        "client",
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("phone_e164", sa.String(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_client_business_id_business")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_client")),
    )
    op.create_index("ix_client_business_id_name", "client", ["business_id", "name"], unique=False)
    op.create_index(
        "uq_client_business_id_phone_e164",
        "client",
        ["business_id", "phone_e164"],
        unique=True,
        postgresql_where="phone_e164 IS NOT NULL",
    )
    op.create_table(
        "product",
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("price_cop", sa.Integer(), nullable=False),
        sa.Column(
            "availability",
            sa.Enum("in_stock", "out_of_stock", name="product_availability"),
            server_default="in_stock",
            nullable=False,
        ),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("sort", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("price_cop >= 0", name=op.f("ck_product_price_non_negative")),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_product_business_id_business")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_product")),
    )
    op.create_index(
        "ix_product_business_id_active_sort",
        "product",
        ["business_id", "active", "sort"],
        unique=False,
    )
    op.create_table(
        "resource",
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("capacity", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("capacity > 0", name=op.f("ck_resource_capacity_positive")),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_resource_business_id_business")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_resource")),
    )
    op.create_table(
        "user",
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.Enum("admin", "barber", name="user_role"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("email = lower(email)", name=op.f("ck_user_email_lowercase")),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_user_business_id_business")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user")),
        sa.UniqueConstraint("business_id", "email", name=op.f("uq_user_business_id_email")),
    )
    op.create_table(
        "barber",
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column(
            "visible_in_booking", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_barber_business_id_business")
        ),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], name=op.f("fk_barber_user_id_user")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_barber")),
        sa.UniqueConstraint("user_id", name=op.f("uq_barber_user_id")),
    )
    op.create_table(
        "service",
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("price_cop", sa.Integer(), nullable=False),
        sa.Column("duration_min", sa.Integer(), nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=True),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("sort", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "duration_min > 0 AND mod(duration_min, 5) = 0", name=op.f("ck_service_duration_valid")
        ),
        sa.CheckConstraint("price_cop >= 0", name=op.f("ck_service_price_non_negative")),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_service_business_id_business")
        ),
        sa.ForeignKeyConstraint(
            ["resource_id"], ["resource.id"], name=op.f("fk_service_resource_id_resource")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_service")),
    )
    op.create_index(
        "ix_service_business_id_active_sort",
        "service",
        ["business_id", "active", "sort"],
        unique=False,
    )
    op.create_table(
        "appointment",
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("barber_id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("service_id", sa.Uuid(), nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            sa.Enum("booked", "attended", "no_show", "cancelled", name="appointment_status"),
            server_default="booked",
            nullable=False,
        ),
        sa.Column(
            "source",
            sa.Enum("online", "manual", "walk_in", name="appointment_source"),
            nullable=False,
        ),
        sa.Column("price_cop", sa.Integer(), nullable=False),
        sa.Column("duration_min", sa.Integer(), nullable=False),
        sa.Column("manage_token_hash", sa.String(), nullable=False),
        sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("duration_min > 0", name=op.f("ck_appointment_duration_positive")),
        sa.CheckConstraint("ends_at > starts_at", name=op.f("ck_appointment_ends_after_starts")),
        sa.CheckConstraint("price_cop >= 0", name=op.f("ck_appointment_price_non_negative")),
        sa.ForeignKeyConstraint(
            ["barber_id"], ["barber.id"], name=op.f("fk_appointment_barber_id_barber")
        ),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business.id"], name=op.f("fk_appointment_business_id_business")
        ),
        sa.ForeignKeyConstraint(
            ["client_id"], ["client.id"], name=op.f("fk_appointment_client_id_client")
        ),
        sa.ForeignKeyConstraint(
            ["resource_id"], ["resource.id"], name=op.f("fk_appointment_resource_id_resource")
        ),
        sa.ForeignKeyConstraint(
            ["service_id"], ["service.id"], name=op.f("fk_appointment_service_id_service")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_appointment")),
        sa.UniqueConstraint("manage_token_hash", name=op.f("uq_appointment_manage_token_hash")),
    )
    op.create_index(
        "ix_appointment_barber_id_starts_at",
        "appointment",
        ["barber_id", "starts_at"],
        unique=False,
    )
    op.create_index(
        "ix_appointment_business_id_starts_at",
        "appointment",
        ["business_id", "starts_at"],
        unique=False,
    )
    op.create_table(
        "barber_schedule",
        sa.Column("barber_id", sa.Uuid(), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "end_time > start_time", name=op.f("ck_barber_schedule_end_after_start")
        ),
        sa.CheckConstraint(
            "weekday BETWEEN 0 AND 6", name=op.f("ck_barber_schedule_weekday_range")
        ),
        sa.ForeignKeyConstraint(
            ["barber_id"], ["barber.id"], name=op.f("fk_barber_schedule_barber_id_barber")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_barber_schedule")),
    )
    op.create_table(
        "barber_time_off",
        sa.Column("barber_id", sa.Uuid(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "ends_at > starts_at", name=op.f("ck_barber_time_off_ends_after_starts")
        ),
        sa.ForeignKeyConstraint(
            ["barber_id"], ["barber.id"], name=op.f("fk_barber_time_off_barber_id_barber")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_barber_time_off")),
    )

    # Rango semiabierto [): una cita que termina a las 10:45 y otra que empieza a las 10:45
    # NO se solapan. Violación => SQLSTATE 23P01 (exclusion_violation).
    op.execute(
        "ALTER TABLE appointment ADD CONSTRAINT appointment_no_barber_overlap "
        "EXCLUDE USING gist (barber_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) "
        "WHERE (status IN ('booked','attended'))"
    )
    op.execute(
        "ALTER TABLE appointment ADD CONSTRAINT appointment_no_resource_overlap "
        "EXCLUDE USING gist (resource_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) "
        "WHERE (resource_id IS NOT NULL AND status IN ('booked','attended'))"
    )


def downgrade() -> None:
    """Revierte el esquema. btree_gist se deja instalada: otras bases/objetos podrían usarla."""
    op.drop_constraint("appointment_no_resource_overlap", "appointment")
    op.drop_constraint("appointment_no_barber_overlap", "appointment")
    op.drop_table("barber_time_off")
    op.drop_table("barber_schedule")
    op.drop_index("ix_appointment_business_id_starts_at", table_name="appointment")
    op.drop_index("ix_appointment_barber_id_starts_at", table_name="appointment")
    op.drop_table("appointment")
    op.drop_index("ix_service_business_id_active_sort", table_name="service")
    op.drop_table("service")
    op.drop_table("barber")
    op.drop_table("user")
    op.drop_table("resource")
    op.drop_index("ix_product_business_id_active_sort", table_name="product")
    op.drop_table("product")
    op.drop_index(
        "uq_client_business_id_phone_e164",
        table_name="client",
        postgresql_where="phone_e164 IS NOT NULL",
    )
    op.drop_index("ix_client_business_id_name", table_name="client")
    op.drop_table("client")
    op.drop_table("business")
    for enum_name in (
        "appointment_source",
        "appointment_status",
        "product_availability",
        "user_role",
    ):
        op.execute(f"DROP TYPE {enum_name}")
