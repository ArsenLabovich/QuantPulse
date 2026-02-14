"""Market Data Service.

Handles fetching historical candle data from external providers (Yahoo Finance)
and storing it in the database for analytics.
"""

import logging
import yfinance as yf
import pandas as pd
from datetime import datetime, timezone
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import select
from sqlalchemy.sql import func
from models.market_data import HistoricalCandle

logger = logging.getLogger(__name__)


class MarketDataService:
    @staticmethod
    async def fetch_and_store_history(db: AsyncSession, symbol: str, period: str = "2y", interval: str = "1d") -> int:
        """Fetches historical data from Yahoo Finance and stores it in the DB.

        Args:
            db: Database session.
            symbol: Ticker symbol (e.g. "AAPL", "BTC-USD").
            period: History period (1y, 2y, 5y, max).
            interval: Data resolution (1d).

        Returns:
            Number of candles inserted/updated.
        """
        try:
            # 1. Fetch from Yahoo Finance (Synchronous, but fast enough for background tasks)
            # For heavy loads, run this in a threadpool executor.
            ticker = yf.Ticker(symbol)
            # auto_adjust=True accounts for splits/dividends in the Close price
            df = ticker.history(period=period, interval=interval, auto_adjust=True)

            if df.empty:
                logger.warning(f"No historical data found for {symbol}")
                return 0

            # 2. Convert DataFrame to Dictionaries
            candles_data = []
            for index, row in df.iterrows():
                # Index is Timestamp
                ts = index.to_pydatetime()
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)

                candles_data.append(
                    {
                        "symbol": symbol,
                        "timestamp": ts,
                        "open": float(row["Open"]),
                        "high": float(row["High"]),
                        "low": float(row["Low"]),
                        "close": float(row["Close"]),
                        "volume": int(row["Volume"]),
                    }
                )

            if not candles_data:
                return 0

            # 3. Bulk Upsert
            # Use PostgreSQL ON CONFLICT to update existing records
            stmt = insert(HistoricalCandle).values(candles_data)
            stmt = stmt.on_conflict_do_update(
                index_elements=["symbol", "timestamp"],
                set_={
                    "open": stmt.excluded.open,
                    "high": stmt.excluded.high,
                    "low": stmt.excluded.low,
                    "close": stmt.excluded.close,
                    "volume": stmt.excluded.volume,
                    "updated_at": func.now(),
                },
            )

            await db.execute(stmt)
            await db.commit()

            logger.info(f"Stored {len(candles_data)} candles for {symbol}")
            return len(candles_data)

        except Exception as e:
            logger.error(f"Failed to fetch market data for {symbol}: {e}")
            await db.rollback()
            return 0

    @staticmethod
    async def get_candles(db: AsyncSession, symbol: str, days: int = 365) -> List[HistoricalCandle]:
        """Retrieves historical candles from DB for analysis."""
        cutoff = datetime.now(timezone.utc) - pd.Timedelta(days=days)

        result = await db.execute(
            select(HistoricalCandle)
            .where(HistoricalCandle.symbol == symbol, HistoricalCandle.timestamp >= cutoff)
            .order_by(HistoricalCandle.timestamp.asc())
        )
        return result.scalars().all()
