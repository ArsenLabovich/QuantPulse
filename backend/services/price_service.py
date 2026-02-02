import logging
import datetime
from typing import Optional
from sqlalchemy import select, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from models.assets import MarketPriceHistory

logger = logging.getLogger(__name__)

class PriceTrackingService:
    @staticmethod
    async def record_price(
        db: AsyncSession, 
        symbol: str, 
        provider_id: str, 
        price: float, 
        currency: str
    ):
        """
        Records the current price into history.
        Optimized: Only records if the last entry is older than 5 minutes to save DB space.
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
        Calculates the percentage change over the last 24 hours (Moving Window).
        Logic:
        1. Find a point roughly 24 hours ago.
        2. If history < 24h, find the ALL time oldest point.
        3. Calculate difference.
        """
        if current_price <= 0:
            return 0.0

        target_time = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=24)
        
        # 1. Try to find a point older than or equal to 24h ago (The ideal anchor)
        # actually, simply finding the closest point to `target_time`.
        # We want the newest point that is <= target_time. (The state of the world just before 24h window).
        # Or... purely just "Oldest point we have if nothing is 24h old".
        
        # Strategy:
        # Get the latest point that is <= target_time. (e.g. yesterday at 09:00 if now is 09:05)
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
            # Fallback: We don't have 24h history. Use the Oldest available point.
            # (e.g. created 5 mins ago)
            result = await db.execute(
                select(MarketPriceHistory)
                .where(
                    MarketPriceHistory.symbol == symbol,
                    MarketPriceHistory.provider_id == provider_id
                )
                .order_by(MarketPriceHistory.timestamp.asc()) # Oldest
                .limit(1)
            )
            historical_point = result.scalar_one_or_none()

        if not historical_point:
            # No history at all (first run)
            return 0.0
            
        old_price = float(historical_point.price)
        if old_price == 0:
            return 0.0
            
        change = ((current_price - old_price) / old_price) * 100
        return change
