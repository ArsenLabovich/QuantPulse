"""Database model for persisted analytics results."""

import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Numeric, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from core.database import Base


class AnalyticsResult(Base):
    __tablename__ = "analytics_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    metric_name = Column(String, nullable=False)
    asset_filter = Column(String, nullable=False, default="all")
    value = Column(Numeric(precision=30, scale=8), nullable=True)
    display_value = Column(String, nullable=True)
    status = Column(String, nullable=False, default="ready")
    confidence = Column(String, nullable=True)
    meta = Column(JSON, nullable=True)
    computed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "metric_name", "asset_filter", name="uq_user_metric_filter"),)
