"""Database models for market data."""

from sqlalchemy import Column, String, DateTime, Numeric, BigInt
from sqlalchemy.sql import func
from core.database import Base


class HistoricalCandle(Base):
    """Historical OHLCV data for an asset.

    Stored with daily resolution (time=00:00:00 UTC).
    """

    __tablename__ = "historical_candles"

    symbol = Column(String, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), primary_key=True, index=True)

    open = Column(Numeric(precision=30, scale=8), nullable=False)
    high = Column(Numeric(precision=30, scale=8), nullable=False)
    low = Column(Numeric(precision=30, scale=8), nullable=False)
    close = Column(Numeric(precision=30, scale=8), nullable=False)
    volume = Column(BigInt, nullable=True)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
