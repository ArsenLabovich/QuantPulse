"""fix missing change_24h

Revision ID: fix_missing_change_24h
Revises: fix_missing_current_price
Create Date: 2026-02-03 21:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fix_missing_change_24h'
down_revision: Union[str, None] = 'fix_missing_current_price'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add missing 'change_24h' column which caused 500 errors on prod
    op.add_column('unified_assets', sa.Column('change_24h', sa.Numeric(precision=10, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column('unified_assets', 'change_24h')
