"""add_phase5_monitoring_execution_tables

Revision ID: a1b2c3d4e5f6
Revises: e4a719c28901
Create Date: 2026-11-12 18:18:30.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'e4a719c28901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if 'monitoring_configs' not in existing_tables:
        op.create_table(
            'monitoring_configs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('frequency', sa.String(length=30), nullable=False, server_default='monthly'),
            sa.Column('target_email', sa.String(length=255), nullable=False),
            sa.Column('next_run_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('last_run_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('last_status', sa.String(length=30), nullable=True),
            sa.Column('last_error', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id'),
        )
        op.create_index(op.f('ix_monitoring_configs_id'), 'monitoring_configs', ['id'], unique=False)
        op.create_index(op.f('ix_monitoring_configs_user_id'), 'monitoring_configs', ['user_id'], unique=True)
        op.create_index(op.f('ix_monitoring_configs_is_enabled'), 'monitoring_configs', ['is_enabled'], unique=False)
        op.create_index(op.f('ix_monitoring_configs_target_email'), 'monitoring_configs', ['target_email'], unique=False)
        op.create_index(op.f('ix_monitoring_configs_next_run_at'), 'monitoring_configs', ['next_run_at'], unique=False)

    if 'monitoring_executions' not in existing_tables:
        op.create_table(
            'monitoring_executions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('config_id', sa.Integer(), nullable=True),
            sa.Column('trigger_type', sa.String(length=20), nullable=False, server_default='scheduled'),
            sa.Column('status', sa.String(length=30), nullable=False, server_default='completed'),
            sa.Column('target_email', sa.String(length=255), nullable=False),
            sa.Column('findings_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('verified_findings_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('scan_id', sa.Integer(), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('execution_window_key', sa.String(length=120), nullable=True),
            sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['config_id'], ['monitoring_configs.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['scan_id'], ['exposure_scans.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_monitoring_executions_id'), 'monitoring_executions', ['id'], unique=False)
        op.create_index(op.f('ix_monitoring_executions_user_id'), 'monitoring_executions', ['user_id'], unique=False)
        op.create_index(op.f('ix_monitoring_executions_config_id'), 'monitoring_executions', ['config_id'], unique=False)
        op.create_index(op.f('ix_monitoring_executions_status'), 'monitoring_executions', ['status'], unique=False)
        op.create_index(op.f('ix_monitoring_executions_execution_window_key'), 'monitoring_executions', ['execution_window_key'], unique=True)
        op.create_index(op.f('ix_monitoring_executions_started_at'), 'monitoring_executions', ['started_at'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if 'monitoring_executions' in existing_tables:
        op.drop_table('monitoring_executions')
    if 'monitoring_configs' in existing_tables:
        op.drop_table('monitoring_configs')

