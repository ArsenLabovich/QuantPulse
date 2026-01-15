"""add_integrations_table

Revision ID: add_integrations_001
Revises: 38c328a9b6fd
Create Date: 2026-01-14 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_integrations_001'
down_revision: Union[str, None] = '38c328a9b6fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create integrations table
    # SQLAlchemy will automatically create the enum type when creating the table
    op.create_table('integrations',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('provider_id', postgresql.ENUM('binance', 'trading212', 'ethereum', name='providerid'), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('credentials', sa.String(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
    sa.Column('settings', postgresql.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_integrations_id'), 'integrations', ['id'], unique=False)
    op.create_index(op.f('ix_integrations_user_id'), 'integrations', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_integrations_user_id'), table_name='integrations')
    op.drop_index(op.f('ix_integrations_id'), table_name='integrations')
    op.drop_table('integrations')
    op.execute("DROP TYPE providerid")
