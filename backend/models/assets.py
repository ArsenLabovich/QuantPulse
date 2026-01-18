from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Enum, Numeric, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from core.database import Base

class AssetType(str, enum.Enum):
    CRYPTO = "crypto"
    STOCK = "stock"
    FIAT = "fiat"

class UnifiedAsset(Base):
    __tablename__ = "unified_assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    integration_id = Column(UUID(as_uuid=True), ForeignKey("integrations.id"), nullable=True, index=True)
    symbol = Column(String, nullable=False, index=True)
    name = Column(String, nullable=True) # Full name e.g. "Bitcoin"
    original_name = Column(String, nullable=False)
    asset_type = Column(Enum(AssetType), nullable=False)
    amount = Column(Numeric(precision=30, scale=8), nullable=False)
    usd_value = Column(Numeric(precision=30, scale=8), nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    total_value_usd = Column(Numeric(precision=30, scale=8), nullable=False)
    data = Column(JSON, nullable=True) # Store breakdown or metadata if needed

class PortfolioAggregate(Base):
    __tablename__ = "portfolio_aggregates"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True, index=True)
    symbol = Column(String, primary_key=True, index=True)
    total_amount = Column(Numeric(precision=30, scale=8), nullable=False)
    weighted_avg_price = Column(Numeric(precision=30, scale=8), nullable=True)
