"""add_name_to_unified_assets.

Revision ID: 224ec1c73ddd
Revises: 1aa41f4fff5d
Create Date: 2026-01-17 18:29:28.236153

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "224ec1c73ddd"
down_revision: Union[str, Sequence[str], None] = "1aa41f4fff5d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("unified_assets", sa.Column("name", sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("unified_assets", "name")
