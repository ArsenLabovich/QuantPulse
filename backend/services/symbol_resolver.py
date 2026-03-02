"""Symbol Resolution Service.

Resolves broker-provided ticker symbols (e.g. "VWRPL") to Yahoo Finance
compatible symbols (e.g. "VWRPL.XC") using a Chain of Responsibility pattern.

Strategies are tried in order until one succeeds:
    1. RedisCacheStrategy    — instant hit from previously resolved mappings
    2. StaticMapStrategy     — hardcoded overrides for known edge cases
    3. DirectTickerStrategy  — checks if the symbol works as-is on Yahoo
    4. YahooSearchStrategy   — automatic discovery via yf.Search()

All successful resolutions are cached in Redis for subsequent lookups.

Usage:
    resolver = SymbolResolver.default()
    market_symbol = await resolver.resolve("VWRPL")  # -> "VWRPL.XC"
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import List, Optional

import yfinance as yf

from core.redis import get_redis_client

logger = logging.getLogger(__name__)

# ─── Redis Key Prefix ────────────────────────────────────────────────────────

_SYMBOL_MAP_PREFIX = "analytics:symbol_map:"


# ─── Strategy Interface ──────────────────────────────────────────────────────


class ResolutionStrategy(ABC):
    """Single step in the symbol resolution chain."""

    @abstractmethod
    async def resolve(self, symbol: str, name: Optional[str] = None, isin: Optional[str] = None) -> Optional[str]:
        """Attempt to resolve *symbol* to a Yahoo-compatible ticker.

        Returns:
            Resolved symbol string, or None to pass to next strategy.
        """


# ─── Concrete Strategies ─────────────────────────────────────────────────────


class RedisCacheStrategy(ResolutionStrategy):
    """Check Redis for a previously resolved mapping."""

    async def resolve(self, symbol: str, name: Optional[str] = None, isin: Optional[str] = None) -> Optional[str]:
        redis = get_redis_client()
        cached = await redis.get(f"{_SYMBOL_MAP_PREFIX}{symbol}")
        if cached:
            result = cached.decode("utf-8") if isinstance(cached, bytes) else cached
            logger.debug(f"[SymbolResolver] Redis hit: {symbol} -> {result}")
            return result
        return None


class ISINSearchStrategy(ResolutionStrategy):
    """Attempt to resolve the symbol using its ISIN via Yahoo Finance Search."""

    async def resolve(self, symbol: str, name: Optional[str] = None, isin: Optional[str] = None) -> Optional[str]:
        if not isin:
            return None

        try:
            loop = asyncio.get_event_loop()
            search = await loop.run_in_executor(None, lambda: yf.Search(isin))

            if search.quotes:
                # We can reasonably trust the first result for an ISIN since ISIN is unique
                best_sym = search.quotes[0].get("symbol")
                if best_sym:
                    logger.debug(f"[SymbolResolver] ISIN Match found: {isin} -> {best_sym}")
                    return best_sym
        except Exception as e:
            logger.debug(f"[SymbolResolver] ISIN check failed for {isin}: {e}")

        return None


class DirectTickerStrategy(ResolutionStrategy):
    """Check if the symbol already works on Yahoo Finance without any suffix.

    This prevents the YahooSearchStrategy from incorrectly resolving
    well-known US tickers (e.g. AAPL, MSFT) to exotic exchanges
    (e.g. AAPL.BA, MSFT.MX).

    Performs a lightweight check: fetches just 5 days of history.
    If data comes back, the symbol is valid as-is.
    """

    async def resolve(self, symbol: str, name: Optional[str] = None, isin: Optional[str] = None) -> Optional[str]:
        try:
            loop = asyncio.get_event_loop()

            def _check():
                ticker = yf.Ticker(symbol)
                df = ticker.history(period="5d", interval="1d", auto_adjust=True)
                return df is not None and not df.empty

            has_data = await loop.run_in_executor(None, _check)

            if has_data:
                logger.debug(f"[SymbolResolver] Direct ticker valid: {symbol}")
                return symbol

        except Exception as e:
            logger.debug(f"[SymbolResolver] Direct ticker check failed for {symbol}: {e}")

        return None


# ─── Orchestrator ─────────────────────────────────────────────────────────────


class SymbolResolver:
    """Runs resolution strategies in order and caches successful results.

    The resolver is stateless (all state lives in Redis), so a single
    instance can be shared across the entire application.
    """

    def __init__(self, strategies: List[ResolutionStrategy]) -> None:
        self._strategies = strategies

    async def resolve(self, symbol: str, name: Optional[str] = None, isin: Optional[str] = None) -> str:
        """Resolve *symbol* to a Yahoo-compatible ticker.

        Tries each strategy in order. The first non-None result wins
        and is persisted to Redis for future lookups.

        If all strategies return None, the original symbol is returned
        and cached to avoid repeated search attempts.
        """
        # Skip resolution for fiat pairs (already formatted)
        if symbol.endswith("=X"):
            return symbol

        for strategy in self._strategies:
            result = await strategy.resolve(symbol, name=name, isin=isin)
            if result is not None:
                # Cache in Redis (unless it came from cache already)
                if not isinstance(strategy, RedisCacheStrategy):
                    await self._cache(symbol, result)
                return result

        # No strategy succeeded — cache the original to avoid repeated lookups
        logger.warning(f"[SymbolResolver] No resolution found for {symbol}, using as-is")
        await self._cache(symbol, symbol)
        return symbol

    @staticmethod
    async def _cache(symbol: str, resolved: str) -> None:
        redis = get_redis_client()
        await redis.set(f"{_SYMBOL_MAP_PREFIX}{symbol}", resolved)

    # ─── Factory ──────────────────────────────────────────────────────────

    @classmethod
    def default(cls) -> "SymbolResolver":
        """Create a resolver with the standard strategy chain."""
        return cls(
            [
                RedisCacheStrategy(),  # 1. Instant Redis cache lookup
                ISINSearchStrategy(),  # 2. Try Yahoo Finance Search by ISIN
                DirectTickerStrategy(),  # 3. Try symbol as-is on Yahoo
            ]
        )
