"""add_phase4_security_intelligence_tables

Revision ID: 93f5cdbf0cbb
Revises: b52062456afb
Create Date: 2026-11-08 17:49:01.671753

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '93f5cdbf0cbb'
down_revision: Union[str, Sequence[str], None] = 'b52062456afb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. security_recommendations
    if 'security_recommendations' not in existing_tables:
        op.create_table(
            'security_recommendations',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('category', sa.String(length=50), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('reason', sa.Text(), nullable=False),
            sa.Column('suggested_action', sa.Text(), nullable=False),
            sa.Column('priority', sa.String(length=20), nullable=False, server_default='medium'),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
            sa.Column('is_demo', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_security_recommendations_id'), 'security_recommendations', ['id'], unique=False)
        op.create_index(op.f('ix_security_recommendations_user_id'), 'security_recommendations', ['user_id'], unique=False)
        op.create_index(op.f('ix_security_recommendations_category'), 'security_recommendations', ['category'], unique=False)
        op.create_index(op.f('ix_security_recommendations_status'), 'security_recommendations', ['status'], unique=False)
        op.create_index(op.f('ix_security_recommendations_is_demo'), 'security_recommendations', ['is_demo'], unique=False)

    # 2. security_activities
    if 'security_activities' not in existing_tables:
        op.create_table(
            'security_activities',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('activity_type', sa.String(length=50), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='info'),
            sa.Column('metadata_json', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_security_activities_id'), 'security_activities', ['id'], unique=False)
        op.create_index(op.f('ix_security_activities_user_id'), 'security_activities', ['user_id'], unique=False)
        op.create_index(op.f('ix_security_activities_activity_type'), 'security_activities', ['activity_type'], unique=False)
        op.create_index(op.f('ix_security_activities_created_at'), 'security_activities', ['created_at'], unique=False)

    # 3. privacy_risk_history
    if 'privacy_risk_history' not in existing_tables:
        op.create_table(
            'privacy_risk_history',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('score', sa.Integer(), nullable=False),
            sa.Column('category', sa.String(length=30), nullable=False),
            sa.Column('factors_json', sa.JSON(), nullable=False),
            sa.Column('is_demo', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('calculated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_privacy_risk_history_id'), 'privacy_risk_history', ['id'], unique=False)
        op.create_index(op.f('ix_privacy_risk_history_user_id'), 'privacy_risk_history', ['user_id'], unique=False)
        op.create_index(op.f('ix_privacy_risk_history_is_demo'), 'privacy_risk_history', ['is_demo'], unique=False)
        op.create_index(op.f('ix_privacy_risk_history_calculated_at'), 'privacy_risk_history', ['calculated_at'], unique=False)

    # 4. monitoring_reminders
    if 'monitoring_reminders' not in existing_tables:
        op.create_table(
            'monitoring_reminders',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('target_email', sa.String(length=255), nullable=False),
            sa.Column('frequency', sa.String(length=50), nullable=False, server_default='monthly'),
            sa.Column('next_reminder_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
            sa.Column('last_reminded_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_monitoring_reminders_id'), 'monitoring_reminders', ['id'], unique=False)
        op.create_index(op.f('ix_monitoring_reminders_user_id'), 'monitoring_reminders', ['user_id'], unique=False)
        op.create_index(op.f('ix_monitoring_reminders_target_email'), 'monitoring_reminders', ['target_email'], unique=False)
        op.create_index(op.f('ix_monitoring_reminders_next_reminder_at'), 'monitoring_reminders', ['next_reminder_at'], unique=False)
        op.create_index(op.f('ix_monitoring_reminders_is_active'), 'monitoring_reminders', ['is_active'], unique=False)

    # 5. external_check_records
    if 'external_check_records' not in existing_tables:
        op.create_table(
            'external_check_records',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False),
            sa.Column('check_date', sa.DateTime(timezone=True), nullable=False),
            sa.Column('breaches_found_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('breach_names', sa.JSON(), nullable=False),
            sa.Column('user_notes', sa.Text(), nullable=True),
            sa.Column('is_verified_by_user', sa.Boolean(), nullable=False, server_default='1'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_external_check_records_id'), 'external_check_records', ['id'], unique=False)
        op.create_index(op.f('ix_external_check_records_user_id'), 'external_check_records', ['user_id'], unique=False)
        op.create_index(op.f('ix_external_check_records_email'), 'external_check_records', ['email'], unique=False)
        op.create_index(op.f('ix_external_check_records_check_date'), 'external_check_records', ['check_date'], unique=False)

    # 6. privacy_permission_reviews
    if 'privacy_permission_reviews' not in existing_tables:
        op.create_table(
            'privacy_permission_reviews',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('app_name', sa.String(length=255), nullable=False),
            sa.Column('platform', sa.String(length=50), nullable=False, server_default='Web'),
            sa.Column('permissions_json', sa.JSON(), nullable=False),
            sa.Column('risk_level', sa.String(length=20), nullable=False, server_default='low'),
            sa.Column('review_notes', sa.Text(), nullable=True),
            sa.Column('is_reviewed', sa.Boolean(), nullable=False, server_default='1'),
            sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_privacy_permission_reviews_id'), 'privacy_permission_reviews', ['id'], unique=False)
        op.create_index(op.f('ix_privacy_permission_reviews_user_id'), 'privacy_permission_reviews', ['user_id'], unique=False)
        op.create_index(op.f('ix_privacy_permission_reviews_app_name'), 'privacy_permission_reviews', ['app_name'], unique=False)

    # 7. security_reports
    if 'security_reports' not in existing_tables:
        op.create_table(
            'security_reports',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('report_title', sa.String(length=255), nullable=False),
            sa.Column('file_path', sa.String(length=500), nullable=False),
            sa.Column('file_size_bytes', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('risk_score', sa.Integer(), nullable=True),
            sa.Column('risk_category', sa.String(length=50), nullable=True),
            sa.Column('summary_json', sa.JSON(), nullable=False),
            sa.Column('is_demo', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_security_reports_id'), 'security_reports', ['id'], unique=False)
        op.create_index(op.f('ix_security_reports_user_id'), 'security_reports', ['user_id'], unique=False)
        op.create_index(op.f('ix_security_reports_is_demo'), 'security_reports', ['is_demo'], unique=False)
        op.create_index(op.f('ix_security_reports_created_at'), 'security_reports', ['created_at'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    tables = [
        'security_reports',
        'privacy_permission_reviews',
        'external_check_records',
        'monitoring_reminders',
        'privacy_risk_history',
        'security_activities',
        'security_recommendations',
    ]
    for tbl in tables:
        if tbl in existing_tables:
            op.drop_table(tbl)
