"""Pydantic schemas for brokerage and exchange integrations."""

from pydantic import BaseModel
from typing import Optional, Dict, Any
from models.integration import ProviderID
from uuid import UUID
from datetime import datetime


class IntegrationBase(BaseModel):
    name: str
    provider_id: ProviderID
    settings: Optional[Dict[str, Any]] = None


class IntegrationCreate(IntegrationBase):
    credentials: Dict[str, Any]  # Will be encrypted before storage


class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    settings: Optional[Dict[str, Any]] = None


class Integration(IntegrationBase):
    id: UUID
    user_id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class IntegrationResponse(BaseModel):
    """Response model that excludes credentials for security."""

    id: UUID
    user_id: int
    provider_id: ProviderID
    name: str
    is_active: bool
    settings: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BinanceCredentials(BaseModel):
    """Schema for Binance API credentials."""

    api_key: str
    api_secret: str
