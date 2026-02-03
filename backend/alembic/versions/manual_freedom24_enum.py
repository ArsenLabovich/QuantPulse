"""add freedom24 enum

Revision ID: manual_freedom24_enum
Revises: db8e60ffd7f6
Create Date: 2026-02-03 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'manual_freedom24_enum'
down_revision: Union[str, None] = 'db8e60ffd7f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres ENUM update
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE providerid ADD VALUE 'freedom24'")


def downgrade() -> None:
    # Removing values from ENUM in Postgres is complex and usually not done in simple downgrades
    pass
