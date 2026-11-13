"""create_exposure_scan_tables

Revision ID: f8fdcfd333dc
Revises: cc6ffeec3c07
Create Date: 2026-11-08 14:04:11.216066

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8fdcfd333dc'
down_revision: Union[str, Sequence[str], None] = 'cc6ffeec3c07'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if table already created by Base.metadata.create_all
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "exposure_scans" not in existing_tables:
        op.create_table(
            'exposure_scans',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False),
            sa.Column('status', sa.String(length=50), nullable=False),
            sa.Column('breaches_count', sa.Integer(), nullable=False),
            sa.Column('exposed_categories_count', sa.Integer(), nullable=False),
            sa.Column('risk_score', sa.Integer(), nullable=False),
            sa.Column('risk_level', sa.String(length=20), nullable=False),
            sa.Column('provider', sa.String(length=50), nullable=False),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_exposure_scans_id'), 'exposure_scans', ['id'], unique=False)
        op.create_index(op.f('ix_exposure_scans_user_id'), 'exposure_scans', ['user_id'], unique=False)
        op.create_index(op.f('ix_exposure_scans_email'), 'exposure_scans', ['email'], unique=False)
        op.create_index(op.f('ix_exposure_scans_created_at'), 'exposure_scans', ['created_at'], unique=False)

    if "breach_findings" not in existing_tables:
        op.create_table(
            'breach_findings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('scan_id', sa.Integer(), nullable=False),
            sa.Column('breach_name', sa.String(length=255), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('domain', sa.String(length=255), nullable=True),
            sa.Column('breach_date', sa.String(length=50), nullable=True),
            sa.Column('added_date', sa.DateTime(timezone=True), nullable=True),
            sa.Column('modified_date', sa.DateTime(timezone=True), nullable=True),
            sa.Column('pwn_count', sa.Integer(), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('logo_url', sa.String(length=500), nullable=True),
            sa.Column('data_classes', sa.JSON(), nullable=False),
            sa.Column('is_verified', sa.Boolean(), nullable=False),
            sa.Column('is_fabricated', sa.Boolean(), nullable=False),
            sa.Column('is_sensitive', sa.Boolean(), nullable=False),
            sa.Column('is_retired', sa.Boolean(), nullable=False),
            sa.Column('is_spam_list', sa.Boolean(), nullable=False),
            sa.Column('is_malware', sa.Boolean(), nullable=False),
            sa.Column('severity', sa.String(length=20), nullable=False),
            sa.Column('recommended_actions', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['scan_id'], ['exposure_scans.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_breach_findings_id'), 'breach_findings', ['id'], unique=False)
        op.create_index(op.f('ix_breach_findings_scan_id'), 'breach_findings', ['scan_id'], unique=False)
        op.create_index(op.f('ix_breach_findings_breach_name'), 'breach_findings', ['breach_name'], unique=False)


def downgrade() -> None:
    op.drop_table('breach_findings')
    op.drop_table('exposure_scans')
