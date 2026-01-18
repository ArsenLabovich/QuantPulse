from sqlalchemy import Column, String, Boolean, ForeignKey, JSON, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from core.database import Base
import enum


class ProviderID(str, enum.Enum):
    binance = "binance"
    trading212 = "trading212"
    ethereum = "ethereum"


class Integration(Base):
    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(ForeignKey("users.id"), nullable=False, index=True)
    provider_id = Column(Enum(ProviderID), nullable=False)
    name = Column(String, nullable=False)
    credentials = Column(String, nullable=False)  # Encrypted JSON blob
    is_active = Column(Boolean, default=True, nullable=False)
    settings = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
