"""
Price Tracking Service — Manages asset price history and market metrics.

This service is responsible for persisting historical price data and 
calculating time-based performance metrics (like 24h change) using 
persistent storage.
"""
import logging
import datetime
from typing import Optional
from sqlalchemy import select, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from models.assets import MarketPriceHistory

logger = logging.getLogger(__name__)

class PriceTrackingService:
    """
    Utility service for recording and analyzing market prices.
    Used during synchronization tasks to provide historical context.
    """
    @staticmethod
    async def record_price(
        db: AsyncSession, 
        symbol: str, 
        provider_id: str, 
        price: float, 
        currency: str
    ):
        """
        Records the current price of an asset in the history table.
        
        To prevent database bloat, this method implements a 5-minute throttling:
        it will not record a new entry if an entry for the same asset/provider 
        exists within the last 5 minutes.
        """
        if price <= 0:
            return

        # Check last entry to prevent spam
        recent_cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=5)
        
        result = await db.execute(
            select(MarketPriceHistory)
            .where(
                MarketPriceHistory.symbol == symbol,
                MarketPriceHistory.provider_id == provider_id,
                MarketPriceHistory.timestamp >= recent_cutoff
            )
            .order_by(MarketPriceHistory.timestamp.desc())
            .limit(1)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            # Update the existing recent entry to keep it "fresh" or just skip?
            # If we update, we lose the granularity of "5 mins ago". 
            # Better to just skip recording if we have a recent one.
            return

        new_entry = MarketPriceHistory(
            symbol=symbol,
            provider_id=provider_id,
            price=price,
            currency=currency
        )
        db.add(new_entry)
        # Commit should be handled by caller or here? 
        # Usually caller (task) manages transaction, but let's be safe.
        # If we use the same session as the task, we shouldn't commit mid-transaction if user doesn't want to.
        # But here we are just adding to session.
        
    @staticmethod
    async def calculate_24h_change(
        db: AsyncSession, 
        symbol: str, 
        provider_id: str, 
        current_price: float
    ) -> float:
        """
        Calculates the percentage price change over the last 24 hours.
        
        Algorithm:
        1. Look for the closest historical price point that is exactly 24h old.
        2. If 24h of history is missing, fallback to the oldest available data point.
        3. Returns 0.0 if no history is found or historical price is zero.
        """
        if current_price <= 0:
            return 0.0

        target_time = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=24)
        
        # Phase 1: Seek the anchor point (newest point that is <= 24h ago)
        result = await db.execute(
            select(MarketPriceHistory)
            .where(
                MarketPriceHistory.symbol == symbol,
                MarketPriceHistory.provider_id == provider_id,
                MarketPriceHistory.timestamp <= target_time
            )
            .order_by(MarketPriceHistory.timestamp.desc())
            .limit(1)
        )
        historical_point = result.scalar_one_or_none()
        
        if not historical_point:
            # Fallback: We don't have 24h history, use the absolute oldest entry.
            result = await db.execute(
                select(MarketPriceHistory)
                .where(
                    MarketPriceHistory.symbol == symbol,
                    MarketPriceHistory.provider_id == provider_id
                )
                .order_by(MarketPriceHistory.timestamp.asc()) 
                .limit(1)
            )
            historical_point = result.scalar_one_or_none()

        if not historical_point:
            return 0.0
            
        old_price = float(historical_point.price)
        if old_price == 0:
            return 0.0
            
        return ((current_price - old_price) / old_price) * 100
