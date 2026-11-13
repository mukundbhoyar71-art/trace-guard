"""add_is_demo_to_exposure_scans

Revision ID: b52062456afb
Revises: f8fdcfd333dc
Create Date: 2026-11-08 16:25:07.906159

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b52062456afb'
down_revision: Union[str, Sequence[str], None] = 'f8fdcfd333dc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('exposure_scans')]
    if 'is_demo' not in cols:
        op.add_column('exposure_scans', sa.Column('is_demo', sa.Boolean(), nullable=False, server_default='0'))
        op.create_index(op.f('ix_exposure_scans_is_demo'), 'exposure_scans', ['is_demo'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('exposure_scans')]
    if 'is_demo' in cols:
        op.drop_index(op.f('ix_exposure_scans_is_demo'), table_name='exposure_scans')
        op.drop_column('exposure_scans', 'is_demo')
