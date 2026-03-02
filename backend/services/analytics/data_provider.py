"""Portfolio data provider with date alignment and asset filtering."""

import logging
from typing import Callable, Dict, List, Tuple, Optional

import numpy as np
import pandas as pd
import asyncio
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from models.assets import UnifiedAsset, AssetType
from models.market_data import HistoricalCandle
from models.integration import Integration
from core.redis import get_redis_client
from core.database import get_async_sessionmaker
from services.history_provider import _NEG_CACHE_PREFIX
from services.history_provider_factory import HistoryProviderFactory
from services.analytics.base import AssetFilter, PortfolioData, ANNUALIZE_FACTORS
from core.config import settings

logger = logging.getLogger(__name__)

_FILTER_TO_ASSET_TYPES: Dict[AssetFilter, List[AssetType]] = {
    AssetFilter.CRYPTO: [AssetType.CRYPTO],
    AssetFilter.STOCKS: [AssetType.STOCK],
    AssetFilter.ALL: [AssetType.CRYPTO, AssetType.STOCK, AssetType.FIAT],
}

_HISTORY_FETCH_DAYS = 395  # 365 days + 30 days buffer for rolling window


class AnalyticsDataProvider:
    """Loads user assets, fetches historical prices, and aligns time series."""

    async def get_portfolio_data(
        self,
        db: AsyncSession,
        user_id: int,
        asset_filter: AssetFilter = AssetFilter.ALL,
    ) -> PortfolioData:
        assets = await self._load_user_assets(db, user_id, asset_filter)
        if not assets:
            return self._empty(asset_filter)

        prices_df = await self._load_prices(db, assets)
        if prices_df.empty:
            return self._empty(asset_filter)

        cutoff_1yr = pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=365)
        counts_1yr = prices_df[prices_df.index >= cutoff_1yr].count()

        to_drop = []
        for col in prices_df.columns:
            if counts_1yr.get(col, 0) < 200:
                # Keep fiat base if it exists
                if col == settings.BASE_CURRENCY:
                    continue
                to_drop.append(col)

        if to_drop:
            logger.debug(f"[Analytics] Dropping {len(to_drop)} assets with < 200 days 1Y history: {to_drop}")
            prices_df = prices_df.drop(columns=to_drop)

        if prices_df.empty:
            return self._empty(asset_filter)

        prices_df, dropped = self.align_data(prices_df)
        if len(prices_df) < 2:
            return self._empty(asset_filter)

        valid_assets = [a for a in assets if a.symbol in prices_df.columns]
        if not valid_assets:
            return self._empty(asset_filter)

        weights, total_value = self._compute_weights(valid_assets, prices_df)
        returns_df = prices_df.pct_change().iloc[1:]
        annualize_factor = self._annualize_factor(asset_filter, len(returns_df), prices_df.index)

        return PortfolioData(
            prices_df=prices_df,
            returns_df=returns_df,
            weights=weights,
            symbols=[a.symbol for a in valid_assets],
            asset_filter=asset_filter,
            annualize_factor=annualize_factor,
            trading_days=len(returns_df),
            total_value_usd=total_value,
        )

    async def _load_user_assets(self, db: AsyncSession, user_id: int, asset_filter: AssetFilter) -> List[UnifiedAsset]:
        allowed = _FILTER_TO_ASSET_TYPES[asset_filter]
        result = await db.execute(
            select(UnifiedAsset).where(
                UnifiedAsset.user_id == user_id,
                UnifiedAsset.asset_type.in_(allowed),
                UnifiedAsset.amount > 0,
            )
        )
        return list(result.scalars().all())

    async def _load_prices(
        self,
        db: AsyncSession,
        assets: List[UnifiedAsset],
        progress_cb: Optional[Callable] = None,
    ) -> pd.DataFrame:
        """Optimized: Load historical price data using bulk queries and metadata caching."""
        total_assets = len(assets)
        series: Dict[str, pd.Series] = {}
        redis = get_redis_client()

        # 1. Pre-load integration mapping and resolve DB symbols
        integration_map = await self._load_integrations_for_assets(db, assets)

        asset_info = []
        all_db_syms = set()

        for asset in assets:
            if asset.asset_type == AssetType.FIAT and asset.symbol.upper() == settings.BASE_CURRENCY:
                asset_info.append({"asset": asset, "is_base": True})
                continue

            integration = integration_map.get(str(asset.integration_id))
            provider_id = integration.provider_id if integration else None
            provider = HistoryProviderFactory.get_provider(provider_id)
            db_sym = await provider.db_symbol(asset.symbol, asset.asset_type, name=asset.name, isin=asset.isin)

            all_db_syms.add(db_sym)
            asset_info.append(
                {
                    "asset": asset,
                    "is_base": False,
                    "provider": provider,
                    "db_sym": db_sym,
                    "source_key": HistoryProviderFactory.get_source_key(provider_id),
                }
            )
            # Polite delay for rate limiting
            await asyncio.sleep(0.05)

        # 2. BULK FRESHNESS CHECK (DB + NEGATIVE CACHE)
        # Default 26h threshold from HistoryProvider
        cutoff_fresh = datetime.now(timezone.utc) - pd.Timedelta(hours=26)

        # Check DB for latest candles for all symbols at once
        fresh_res = await db.execute(
            select(HistoricalCandle.symbol, func.max(HistoricalCandle.timestamp))
            .where(HistoricalCandle.symbol.in_(list(all_db_syms)))
            .group_by(HistoricalCandle.symbol)
        )
        latest_ts_map = {row[0]: row[1] for row in fresh_res.all()}

        # Check Negative Cache in Redis (mget is much faster than individual gets)
        neg_cache_keys = [f"{_NEG_CACHE_PREFIX}{sym}" for sym in all_db_syms]
        neg_cache_results = await redis.mget(*neg_cache_keys) if neg_cache_keys else []
        neg_cache_map = {sym: bool(res) for sym, res in zip(list(all_db_syms), neg_cache_results)}

        # Check Positive Fetch Cache in Redis (prevents re-fetching on weekends)
        pos_cache_keys = [f"analytics:fetched:sym:{sym}" for sym in all_db_syms]
        pos_cache_results = await redis.mget(*pos_cache_keys) if pos_cache_keys else []
        pos_cache_map = {sym: bool(res) for sym, res in zip(list(all_db_syms), pos_cache_results)}

        # 3. DISPATCH MISSING DATA TASKS
        fetch_tasks_args = []
        for idx, info in enumerate(asset_info):
            if info["is_base"]:
                series[info["asset"].symbol] = pd.Series(
                    [1.0] * _HISTORY_FETCH_DAYS,
                    index=pd.date_range(
                        end=pd.Timestamp.now(tz="UTC"), periods=_HISTORY_FETCH_DAYS, freq="D", tz="UTC"
                    ),
                )
                continue

            db_sym = info["db_sym"]
            is_cached = (
                (latest_ts_map.get(db_sym) is not None and latest_ts_map.get(db_sym) >= cutoff_fresh)
                or neg_cache_map.get(db_sym, False)
                or pos_cache_map.get(db_sym, False)
            )

            if progress_cb:
                await progress_cb("fetching", idx + 1, total_assets, info["asset"].symbol, is_cached)

            if not is_cached:
                fetch_tasks_args.append(
                    (
                        info["source_key"],
                        info["asset"].symbol,
                        info["asset"].asset_type.value,
                        info["asset"].name,
                        info["asset"].isin,
                        "1y",
                        info["db_sym"],
                    )
                )

        if fetch_tasks_args:
            logger.debug(f"[Analytics] Updating {len(fetch_tasks_args)} assets (parallel fetch)...")

            session_factory = get_async_sessionmaker()
            # Lower degree of parallelism to reduce DB connection pressure and avoid rate limits
            sem = asyncio.Semaphore(3)

            async def _fetch_asset(args):
                async with sem:
                    # args format: (source_key, symbol, asset_type_val, name, isin, period, resolved_db_sym)
                    source_key, symbol, asset_type_val, name, isin, period, resolved_db_sym = args

                    # Prevent concurrent workers from fetching same symbol
                    inflight_key = f"fetch_inflight:{resolved_db_sym}"
                    if await redis.get(inflight_key):
                        return None

                    await redis.set(inflight_key, "1", ex=60)  # 1 min lock for fetching

                    provider = HistoryProviderFactory.get_provider_by_source(source_key)
                    try:
                        async with session_factory() as local_db:
                            await provider.fetch_and_store(
                                local_db, symbol, AssetType(asset_type_val), name=name, isin=isin, period=period
                            )
                        return resolved_db_sym
                    except Exception as e:
                        logger.debug(f"[Analytics] Partial fetch failure for {symbol}: {e}")
                        return None
                    finally:
                        await redis.delete(inflight_key)

            # Execute all fetches
            db_symbols = await asyncio.gather(*[_fetch_asset(args) for args in fetch_tasks_args])

            # Mark successfully fetched symbols in Redis
            for db_sym in db_symbols:
                if db_sym:
                    await redis.set(f"analytics:fetched:sym:{db_sym}", "1", ex=43200)

            logger.debug(f"[Analytics] Finished update for {len(fetch_tasks_args)} assets.")

        # 4. BULK CANDLE LOADING
        # Now that all data is fetched (either cached or just downloaded), load everything
        cutoff_history = pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=_HISTORY_FETCH_DAYS)
        candle_res = await db.execute(
            select(HistoricalCandle)
            .where(HistoricalCandle.symbol.in_(list(all_db_syms)), HistoricalCandle.timestamp >= cutoff_history)
            .order_by(HistoricalCandle.timestamp.asc())
        )

        # Group candles by symbol for O(1) assignment
        candles_by_sym = {}
        for c in candle_res.scalars().all():
            if c.symbol not in candles_by_sym:
                candles_by_sym[c.symbol] = ([], [])
            candles_by_sym[c.symbol][0].append(c.timestamp)
            candles_by_sym[c.symbol][1].append(float(c.close))

        # Map back to assets (multiple assets can share same db_sym)
        for info in asset_info:
            if info["is_base"]:
                continue
            db_sym = info["db_sym"]
            symbol = info["asset"].symbol
            if db_sym in candles_by_sym:
                dates, closes = candles_by_sym[db_sym]
                series[symbol] = pd.Series(closes, index=pd.DatetimeIndex(dates))
            else:
                logger.debug(f"No candles found for {symbol} (db_sym={db_sym})")

        if not series:
            return pd.DataFrame()
        return pd.DataFrame(series).sort_index()

    async def _load_integrations_for_assets(
        self, db: AsyncSession, assets: List[UnifiedAsset]
    ) -> Dict[str, Integration]:
        """Load Integration records for all assets that have an integration_id."""
        integration_ids = {str(a.integration_id) for a in assets if a.integration_id}
        if not integration_ids:
            return {}

        result = await db.execute(select(Integration).where(Integration.id.in_(integration_ids)))
        integrations = result.scalars().all()
        return {str(i.id): i for i in integrations}

    @staticmethod
    def align_data(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Aligns data to a strict daily grid and removes assets with fatal gaps."""
        if df.empty:
            return df, []

        # 1. Resample to strict daily grid
        df = df.resample("1D").last()

        # 2. Filter completely empty assets
        df = df.dropna(axis=1, how="all")

        # 3. Forward Fill (Filling all holes INSIDE the asset's trading period)
        df = df.ffill()

        # 4. Backward Fill for the first days (Handling assets that start history after current date - 1Y)
        df = df.bfill()

        # 5. Exclude assets with insufficient history (Late start)
        dropped_symbols = [col for col in df.columns if df[col].isna().any()]
        if dropped_symbols:
            logger.debug(
                f"[Alignment] Dropping tracking for {len(dropped_symbols)} assets "
                f"due to insufficient history: {dropped_symbols}"
            )
            df = df.drop(columns=dropped_symbols)

        return df, dropped_symbols

    @staticmethod
    def _compute_weights(assets: List[UnifiedAsset], prices_df: pd.DataFrame) -> Tuple[np.ndarray, float]:
        last_prices = prices_df.iloc[-1]
        values = [float(last_prices.get(a.symbol, 0)) * float(a.amount) for a in assets]
        total = sum(values)
        if total <= 0:
            n = len(assets)
            return np.ones(n) / n, 0.0
        return np.array([v / total for v in values]), total

    async def get_custom_data(
        self,
        db: AsyncSession,
        symbols: List[str],
        start_date: Optional[pd.Timestamp] = None,
        end_date: Optional[pd.Timestamp] = None,
        progress_cb: Optional[Callable] = None,
    ) -> Tuple[Dict[str, pd.Series], PortfolioData, int]:
        """Fetches data for specific symbols and range.

        Returns:
            - per_asset_returns: Dict[symbol, returns_series] (raw, unaligned)
            - portfolio_data: PortfolioData (aligned for weights/portfolio vol)
            - alignment_loss: number of days dropped during alignment
        """
        # 1. Resolve assets from DB to know their types
        assets_map = await self._load_assets_by_symbols(db, symbols)
        if not assets_map:
            return {}, self._empty(AssetFilter.ALL), 0

        # 2. Load prices for resolved assets
        prices_df = await self._load_prices(db, list(assets_map.values()), progress_cb=progress_cb)
        if prices_df.empty:
            return {}, self._empty(AssetFilter.ALL), 0

        # Filter out assets with < 230 candles in the last 365 days
        cutoff_1yr = pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=365)
        prices_1yr = prices_df[prices_df.index >= cutoff_1yr]

        valid_assets = []
        bad_assets = []
        counts_1yr = prices_1yr.count()
        for col in prices_df.columns:
            # Base currency always valid
            if (
                assets_map[col].asset_type == AssetType.FIAT
                and assets_map[col].symbol.upper() == settings.BASE_CURRENCY
            ):
                valid_assets.append(col)
                continue

            if counts_1yr[col] >= 200:
                valid_assets.append(col)
            else:
                bad_assets.append(col)

        if bad_assets:
            msg = f"Excluding {len(bad_assets)} assets (insufficient history): {', '.join(bad_assets[:10])}"
            if len(bad_assets) > 10:
                msg += "..."
            logger.debug(msg)

        # Save the full prices_df to compute raw returns for bad assets if needed,
        # but actually for bad assets we just want to force them to "insufficient_data".
        # We will keep them in prices_df until we compute per-asset returns.

        # 3. Filter by date range
        if start_date:
            prices_df = prices_df[prices_df.index >= start_date]
        if end_date:
            prices_df = prices_df[prices_df.index <= end_date]

        if prices_df.empty:
            return {}, self._empty(AssetFilter.ALL), 0

        # 4. Compute per-asset returns (RAW, no alignment clipping)
        per_asset_returns = {}
        for col in prices_df.columns:
            if col in bad_assets:
                # Force failure in calculator
                per_asset_returns[col] = pd.Series(dtype=float)
            else:
                asset_prices = prices_df[col].dropna()
                if len(asset_prices) >= 2:
                    returns = asset_prices.pct_change().iloc[1:].replace([np.inf, -np.inf], np.nan).dropna()
                    per_asset_returns[col] = returns

        # Drop bad assets from prices_df so they don't impact portfolio calculation
        prices_df = prices_df[valid_assets]

        # 5. Compute aligned portfolio data
        aligned_df, dropped = self.align_data(prices_df)

        # Alignment loss is no longer relevant as days, but we can return number of dropped assets
        alignment_loss = len(dropped)

        logger.debug(
            f"[Alignment] Raw dates: {len(prices_df)}, Aligned dates: {len(aligned_df)}, "
            f"Dropped assets: {alignment_loss}"
        )

        if len(aligned_df) < 2:
            return per_asset_returns, self._empty(AssetFilter.ALL), alignment_loss

        valid_assets = [assets_map[s] for s in aligned_df.columns if s in assets_map]
        weights, total_value = self._compute_weights(valid_assets, aligned_df)
        returns_df = aligned_df.pct_change().iloc[1:]

        trading_days = len(returns_df)
        annualize_factor = self._annualize_factor(AssetFilter.ALL, trading_days, aligned_df.index)

        portfolio_data = PortfolioData(
            prices_df=aligned_df,
            returns_df=returns_df,
            weights=weights,
            symbols=[a.symbol for a in valid_assets],
            asset_filter=AssetFilter.ALL,
            annualize_factor=float(annualize_factor),
            trading_days=trading_days,
            total_value_usd=total_value,
        )

        return per_asset_returns, portfolio_data, alignment_loss

    async def _load_assets_by_symbols(self, db: AsyncSession, symbols: List[str]) -> Dict[str, UnifiedAsset]:
        result = await db.execute(select(UnifiedAsset).where(UnifiedAsset.symbol.in_(symbols)))
        return {a.symbol: a for a in result.scalars().all()}

    @staticmethod
    def _annualize_factor(asset_filter: AssetFilter, trading_days: int, index: pd.DatetimeIndex) -> float:
        if asset_filter in ANNUALIZE_FACTORS:
            return float(ANNUALIZE_FACTORS[asset_filter])

        # For ALL mixed portfolio, with resample('1D') and ffill(),
        # we have 365 days calendar mapping to 365 trading days.
        return float(np.sqrt(365))

    @staticmethod
    def _empty(asset_filter: AssetFilter) -> PortfolioData:
        return PortfolioData(
            prices_df=pd.DataFrame(),
            returns_df=pd.DataFrame(),
            weights=np.array([]),
            symbols=[],
            asset_filter=asset_filter,
            annualize_factor=float(np.sqrt(252)),
            trading_days=0,
            total_value_usd=0.0,
        )
