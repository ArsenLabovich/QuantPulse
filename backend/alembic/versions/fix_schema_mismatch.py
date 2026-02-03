"""fix missing current_price and enum

Revision ID: fix_schema_mismatch
Revises: db8e60ffd7f6
Create Date: 2026-02-03 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fix_schema_mismatch'
down_revision: Union[str, None] = 'db8e60ffd7f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add missing 'current_price' column
    # Check if column exists to avoid error if re-running? 
    # Alembic usually assumes state based on revision ID. 
    # But since prompts indicated it IS missing, we add it.
    op.add_column('unified_assets', sa.Column('current_price', sa.Numeric(precision=30, scale=8), nullable=True))

    # 2. Update ProviderID Enum (Freedom24) - REMOVED
    # Only fixing the critical missing column for prod
    pass


def downgrade() -> None:
    op.drop_column('unified_assets', 'current_price')
    # Enum downgrade is hard, skipping
    pass
