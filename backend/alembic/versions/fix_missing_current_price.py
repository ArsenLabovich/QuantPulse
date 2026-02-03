"""fix missing current_price

Revision ID: fix_current_price
Revises: db8e60ffd7f6
Create Date: 2026-02-03 21:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fix_current_price'
down_revision: Union[str, None] = 'db8e60ffd7f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add missing 'current_price' column which caused 500 errors
    op.add_column('unified_assets', sa.Column('current_price', sa.Numeric(precision=30, scale=8), nullable=True))


def downgrade() -> None:
    op.drop_column('unified_assets', 'current_price')
