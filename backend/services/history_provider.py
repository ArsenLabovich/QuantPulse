"""History Provider Abstraction Layer.

Defines the interface and concrete implementations for fetching historical
OHLCV candle data from different external sources (Yahoo Finance, CCXT exchanges).
All implementations store data in the same `historical_candles` DB table.
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import List, Optional

import asyncio
import ccxt
import pandas as pd
import yfinance as yf
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from core.config import settings
from core.redis import get_redis_client
from models.assets import AssetType
from models.market_data import HistoricalCandle
from services.symbol_resolver import SymbolResolver


logger = logging.getLogger(__name__)

# Negative cache prefix in Redis
_NEG_CACHE_PREFIX = "analytics:neg_cache:"
_NEGATIVE_CACHE_TTL = 24 * 3600  # 24 hours


# ─── Abstract Base ───────────────────────────────────────────────────────────


class HistoryProvider(ABC):
    """Fetches and stores historical OHLCV candle data."""

    async def fetch_and_store(
        self,
        db: AsyncSession,
        symbol: str,
        asset_type: AssetType,
        name: Optional[str] = None,
        isin: Optional[str] = None,
        period: str = "1y",
    ) -> int:
        """Fetch candles from external source, store in DB.

        Args:
            db: Database session.
            symbol: Clean asset symbol (e.g. "BTC", "AAPL", "EUR").
            asset_type: Type of asset (CRYPTO, STOCK, FIAT).
            name: Optional asset name.
            isin: Optional ISIN code.
            period: History depth (e.g. "1y", "2y").

        Returns:
            Number of candles stored.
        """

    @abstractmethod
    def translate_symbol(self, symbol: str, asset_type: AssetType) -> str:
        """Translate a clean symbol to the provider-specific market symbol.

        Examples:
            Yahoo: "EUR" -> "EURUSD=X", "AAPL" -> "AAPL"
            CCXT:  "BTC" -> "BTC/USDT", "ETH" -> "ETH/USDT"
        """

    @abstractmethod
    async def db_symbol(
        self, symbol: str, asset_type: AssetType, name: Optional[str] = None, isin: Optional[str] = None
    ) -> str:
        """Return the symbol key as stored in the historical_candles DB table.

        This may differ from translate_symbol(). For example:
            Yahoo: db_symbol("EUR", FIAT) -> "EURUSD=X" (same as market symbol)
            CCXT:  db_symbol("BTC", CRYPTO) -> "BTC-USD" (storage key)
        """

    async def is_fresh(self, db: AsyncSession, db_sym: str, max_age_hours: int = 26) -> bool:
        """Check if cached candle data is still fresh (no need to re-fetch).

        Returns True if:
          - the latest candle in DB is within max_age_hours, OR
          - the symbol is in the negative cache (no data available from source).
        Default 26h ensures we re-fetch once per day (daily candles close ~midnight UTC).
        """
        # 1. Check Redis negative cache
        redis = get_redis_client()
        if await redis.get(f"{_NEG_CACHE_PREFIX}{db_sym}"):
            logger.debug(f"[NEG-CACHE HIT] {db_sym} — skipping known failed symbol")
            return True

        # 2. Check DB for latest candle
        cutoff = datetime.now(timezone.utc) - pd.Timedelta(hours=max_age_hours)
        result = await db.execute(
            select(HistoricalCandle.timestamp)
            .where(
                HistoricalCandle.symbol == db_sym,
                HistoricalCandle.timestamp >= cutoff,
            )
            .order_by(HistoricalCandle.timestamp.desc())
            .limit(1)
        )
        latest = result.scalar_one_or_none()

        if latest:
            logger.debug(f"[CACHE HIT] {db_sym} — latest candle at {latest}")
            return True

        return False

    async def get_candles(self, db: AsyncSession, market_symbol: str, days: int = 395) -> List[HistoricalCandle]:
        """Read stored candles from DB (shared implementation)."""
        cutoff = datetime.now(timezone.utc) - pd.Timedelta(days=days)
        result = await db.execute(
            select(HistoricalCandle)
            .where(
                HistoricalCandle.symbol == market_symbol,
                HistoricalCandle.timestamp >= cutoff,
            )
            .order_by(HistoricalCandle.timestamp.asc())
        )
        return list(result.scalars().all())


# ─── Yahoo Finance (Stocks, ETFs, Fiat FX pairs) ────────────────────────────


class YahooHistoryProvider(HistoryProvider):
    """Fetches historical data via Yahoo Finance (yfinance).

    Best for: Stocks, ETFs, Fiat FX pairs, Indices.
    Used by: Trading212, Freedom24 integrations.

    Uses SymbolResolver for automatic discovery of exchange suffixes
    (e.g. VWRPL -> VWRPL.XC) when the broker-provided ticker doesn't
    match Yahoo's format.
    """

    def __init__(self, resolver: Optional[SymbolResolver] = None) -> None:
        self._resolver = resolver or SymbolResolver.default()

    def translate_symbol(self, symbol: str, asset_type: AssetType) -> str:
        s = symbol.upper()
        if asset_type == AssetType.FIAT:
            if s == settings.BASE_CURRENCY:
                return s  # USD -> USD (synthetic, handled upstream)
            return f"{s}{settings.BASE_CURRENCY}=X"  # EUR -> EURUSD=X
        return s

    async def db_symbol(
        self, symbol: str, asset_type: AssetType, name: Optional[str] = None, isin: Optional[str] = None
    ) -> str:
        # For Yahoo, the DB symbol is the resolved market symbol (e.g. VWRPL.XC)
        # 1. Base formatting (EUR -> EURUSD=X)
        base_sym = self.translate_symbol(symbol, asset_type)
        # 2. Market resolution (VWRPL -> VWRPL.XC or search by name)
        return await self._resolver.resolve(base_sym, name=name, isin=isin)

    async def fetch_and_store(
        self,
        db: AsyncSession,
        symbol: str,
        asset_type: AssetType,
        name: Optional[str] = None,
        isin: Optional[str] = None,
        period: str = "1y",
    ) -> int:
        # Base currency is synthetic (always 1.0), skip fetch
        if asset_type == AssetType.FIAT and symbol.upper() == settings.BASE_CURRENCY:
            return 0

        # Resolved market symbol (e.g. AAPL, EURUSD=X, VWRPL.XC)
        db_sym = await self.db_symbol(symbol, asset_type, name=name, isin=isin)
        market_symbol = db_sym  # For Yahoo, they are synonymous once resolved

        try:
            max_retries = 3
            df = None
            for attempt in range(max_retries):
                try:
                    ticker = yf.Ticker(market_symbol)
                    df = await asyncio.get_event_loop().run_in_executor(
                        None, lambda: ticker.history(period=period, interval="1d", auto_adjust=True)
                    )
                    if df is not None and not df.empty:
                        break
                except Exception as e:
                    if "Too Many Requests" in str(e) and attempt < max_retries - 1:
                        wait = (attempt + 1) * 2
                        logger.warning(f"[Yahoo] Rate limited for {market_symbol}. Retrying in {wait}s...")
                        await asyncio.sleep(wait)
                        continue
                    logger.error(f"[Yahoo] Fetch failed for {market_symbol}: {e}")
                    break

            if df is None or df.empty:
                logger.debug(f"[Yahoo] No data for {market_symbol} (db: {db_sym})")
                redis = get_redis_client()
                await redis.setex(f"{_NEG_CACHE_PREFIX}{db_sym}", _NEGATIVE_CACHE_TTL, "1")
                return 0

            # ─── Auto-FX Conversion ──────────────────────────────────────────
            try:
                # Use fast_info for reliable currency data (no extra request)
                currency = ticker.fast_info.get("currency", settings.BASE_CURRENCY)

                if currency in ["GBp", "GBX"]:
                    # LSE uses pence (GBX/GBp). Divide by 100 to get GBP.
                    for col in ["Open", "High", "Low", "Close"]:
                        if col in df.columns:
                            df[col] = df[col] / 100.0
                    currency = "GBP"  # Now we can safely convert GBP to USD
                    logger.debug(f"[Yahoo] {symbol} is priced in pence. Divided by 100 to base GBP.")

                if currency != settings.BASE_CURRENCY:
                    logger.debug(
                        f"[Yahoo] {symbol} is valid but in {currency}. "
                        f"Fetching FX rate to convert to {settings.BASE_CURRENCY}..."
                    )

                    fx_rates = await self._fetch_fx_rate(currency, period)

                    if fx_rates is not None:
                        # Align FX rates to the asset's timestamps
                        # ffill() ensures we use the last known rate for weekends/holidays if needed
                        aligned_fx = fx_rates.reindex(df.index, method="ffill")

                        # Handle potential NaNs at the start (if FX history is shorter or starts later)
                        # bfill() as a fallback
                        aligned_fx = aligned_fx.bfill().fillna(1.0)

                        # Apply conversion
                        for col in ["Open", "High", "Low", "Close"]:
                            if col in df.columns:
                                df[col] = df[col] * aligned_fx

                        logger.debug(
                            f"[Yahoo] Successfully converted {symbol} from {currency} to {settings.BASE_CURRENCY}"
                        )
                    else:
                        logger.warning(
                            f"[Yahoo] Could not fetch FX rate for {currency}. Storing values AS-IS (may be incorrect)."
                        )

            except Exception as e:
                logger.error(f"[Yahoo] FX Conversion failed for {symbol}: {e}")
                # We continue to store original values rather than failing completely
            # ─────────────────────────────────────────────────────────────────

            candles_data = []
            for index, row in df.iterrows():
                ts = index.to_pydatetime()
                # Normalize to Date only (00:00:00 UTC) to prevent duplicates due to hour shifts
                ts = ts.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)

                candles_data.append(
                    {
                        "symbol": db_sym,  # Store under resolved market symbol
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

            # Chunk inserts to 100 to avoid giant SQL logs and parameter limits
            chunk_size = 100
            for i in range(0, len(candles_data), chunk_size):
                chunk = candles_data[i : i + chunk_size]
                stmt = insert(HistoricalCandle).values(chunk)
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

            logger.debug(f"[Yahoo] Stored {len(candles_data)} candles for {market_symbol} (DB: {db_sym})")
            return len(candles_data)

        except Exception as e:
            logger.error(f"[Yahoo] Failed for {market_symbol}: {e}")
            redis = get_redis_client()
            await redis.setex(f"{_NEG_CACHE_PREFIX}{db_sym}", _NEGATIVE_CACHE_TTL, "1")
            await db.rollback()
            return 0

    async def _fetch_fx_rate(self, currency: str, period: str) -> Optional[pd.Series]:
        """Fetch historical exchange rate to convert currency -> BASE_CURRENCY (USD).

        Tries:
            1. Direct pair: {currency}USD=X (e.g. EURUSD=X) -> Rate is multiplier
            2. Inverted pair: USD{currency}=X (e.g. USDMXN=X) -> Rate is 1/price
        """
        loop = asyncio.get_event_loop()

        # 1. Try Direct Pair (e.g. EURUSD=X)
        direct_pair = f"{currency}{settings.BASE_CURRENCY}=X"
        try:
            ticker = yf.Ticker(direct_pair)
            df = await loop.run_in_executor(
                None, lambda: ticker.history(period=period, interval="1d", auto_adjust=True)
            )

            if df is not None and not df.empty:
                logger.debug(f"[Yahoo] Found direct FX pair {direct_pair}")
                return df["Close"]
        except Exception:
            pass

        # 2. Try Inverted Pair (e.g. USDMXN=X)
        inverted_pair = f"{settings.BASE_CURRENCY}{currency}=X"
        try:
            ticker = yf.Ticker(inverted_pair)
            df = await loop.run_in_executor(
                None, lambda: ticker.history(period=period, interval="1d", auto_adjust=True)
            )

            if df is not None and not df.empty:
                logger.debug(f"[Yahoo] Found inverted FX pair {inverted_pair}, using 1/rate")
                # Avoid division by zero
                return 1.0 / df["Close"].replace(0, 1.0)
        except Exception:
            pass

        return None


# ─── CCXT (Crypto Exchanges: Binance, Bybit, etc.) ──────────────────────────

# Stablecoins that should always resolve to ~$1.00 and have minimal volatility
_STABLECOINS = {"USDT", "USDC", "BUSD", "DAI", "FDUSD", "TUSD", "USDP", "USDS"}

# CCXT exchange ID used for public candle data (no auth needed)
_DEFAULT_EXCHANGE = "binance"


class CcxtHistoryProvider(HistoryProvider):
    """Fetches historical data via CCXT from crypto exchanges.

    Best for: Cryptocurrencies.
    Used by: Binance, Bybit integrations.
    """

    def __init__(self, exchange_id: str = _DEFAULT_EXCHANGE) -> None:
        self._exchange_id = exchange_id

    def translate_symbol(self, symbol: str, asset_type: AssetType) -> str:
        s = symbol.upper()
        return f"{s}/USDT"  # BTC -> BTC/USDT

    async def db_symbol(
        self, symbol: str, asset_type: AssetType, name: Optional[str] = None, isin: Optional[str] = None
    ) -> str:
        s = symbol.upper()
        return f"{s}-{settings.BASE_CURRENCY}"  # BTC -> BTC-USD

    async def fetch_and_store(
        self,
        db: AsyncSession,
        symbol: str,
        asset_type: AssetType,
        name: Optional[str] = None,
        isin: Optional[str] = None,
        period: str = "1y",
    ) -> int:
        s = symbol.upper()

        # Base-currency stablecoins: skip, handled as synthetic upstream
        if s == settings.BASE_CURRENCY:
            return 0

        ccxt_symbol = self.translate_symbol(symbol, asset_type)
        db_sym = await self.db_symbol(symbol, asset_type, name=name, isin=isin)

        # Calculate 'since' timestamp from period
        period_days = {"1y": 365, "2y": 730, "6mo": 180, "3mo": 90}.get(period, 365)
        since_ms = int((datetime.now(timezone.utc) - pd.Timedelta(days=period_days)).timestamp() * 1000)

        try:
            # Create exchange instance (public, no auth)
            exchange_class = getattr(ccxt, self._exchange_id)
            exchange = exchange_class({"enableRateLimit": True})

            # Fetch OHLCV in batches (CCXT returns max ~1000 candles per call)
            all_candles = []
            current_since = since_ms

            loop = asyncio.get_event_loop()

            while True:
                ohlcv = await loop.run_in_executor(
                    None,
                    lambda s=current_since: exchange.fetch_ohlcv(ccxt_symbol, timeframe="1d", since=s, limit=1000),
                )
                if not ohlcv:
                    break
                all_candles.extend(ohlcv)
                # Move cursor forward
                last_ts = ohlcv[-1][0]
                if last_ts <= current_since:
                    break
                current_since = last_ts + 1  # Next millisecond after last candle

                # Safety break to avoid infinite loops
                if len(all_candles) > 2000:
                    break

            if not all_candles:
                logger.debug(f"[CCXT/{self._exchange_id}] No data for {ccxt_symbol}")
                return 0

            # Convert to DB format
            candles_data = []
            for ts_ms, open_price, high, low, close, vol in all_candles:
                ts = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
                # Normalize to Date only (00:00:00 UTC)
                ts = ts.replace(hour=0, minute=0, second=0, microsecond=0)
                candles_data.append(
                    {
                        "symbol": db_sym,
                        "timestamp": ts,
                        "open": float(open_price),
                        "high": float(high),
                        "low": float(low),
                        "close": float(close),
                        "volume": int(vol or 0),
                    }
                )

            # Chunk inserts to 100 to avoid giant SQL logs and parameter limits
            chunk_size = 100
            for i in range(0, len(candles_data), chunk_size):
                chunk = candles_data[i : i + chunk_size]
                stmt = insert(HistoricalCandle).values(chunk)
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

            logger.debug(
                f"[CCXT/{self._exchange_id}] Stored {len(candles_data)} candles for {ccxt_symbol} (DB: {db_sym})"
            )
            return len(candles_data)

        except Exception as e:
            logger.error(f"[CCXT/{self._exchange_id}] Failed for {ccxt_symbol}: {e}")
            await db.rollback()
            return 0
