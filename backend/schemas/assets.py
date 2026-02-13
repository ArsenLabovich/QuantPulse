"""Pydantic schemas for financial assets and portfolio distribution."""

from pydantic import BaseModel
from decimal import Decimal
from models.assets import AssetType


class AssetBase(BaseModel):
    symbol: str
    amount: Decimal
    asset_type: AssetType


class UnifiedAssetRead(AssetBase):
    integration_name: str

    class Config:
        from_attributes = True


class PortfolioDistribution(BaseModel):
    symbol: str
    total_amount: Decimal
    allocation_percent: Decimal

    class Config:
        from_attributes = True
