"""add_real_data_scoring_fields

Revision ID: e4a719c28901
Revises: 93f5cdbf0cbb
Create Date: 2026-11-09 01:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e4a719c28901'
down_revision: Union[str, Sequence[str], None] = '93f5cdbf0cbb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # 1. Update privacy_risk_history
    prh_cols = [c['name'] for c in inspector.get_columns('privacy_risk_history')]
    if 'coverage_percentage' not in prh_cols:
        op.add_column('privacy_risk_history', sa.Column('coverage_percentage', sa.Integer(), nullable=False, server_default='0'))
    if 'engine_version' not in prh_cols:
        op.add_column('privacy_risk_history', sa.Column('engine_version', sa.String(length=20), nullable=False, server_default='3.0'))

    # 2. Update breach_findings
    bf_cols = [c['name'] for c in inspector.get_columns('breach_findings')]
    if 'is_resolved' not in bf_cols:
        op.add_column('breach_findings', sa.Column('is_resolved', sa.Boolean(), nullable=False, server_default='0'))
    if 'resolved_at' not in bf_cols:
        op.add_column('breach_findings', sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True))

def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    bf_cols = [c['name'] for c in inspector.get_columns('breach_findings')]
    if 'resolved_at' in bf_cols:
        op.drop_column('breach_findings', 'resolved_at')
    if 'is_resolved' in bf_cols:
        op.drop_column('breach_findings', 'is_resolved')

    prh_cols = [c['name'] for c in inspector.get_columns('privacy_risk_history')]
    if 'engine_version' in prh_cols:
        op.drop_column('privacy_risk_history', 'engine_version')
    if 'coverage_percentage' in prh_cols:
        op.drop_column('privacy_risk_history', 'coverage_percentage')

