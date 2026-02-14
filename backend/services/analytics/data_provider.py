"""Portfolio data provider with date alignment and asset filtering."""

import logging
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.assets import UnifiedAsset, AssetType
from services.market_data import MarketDataService
from services.analytics.base import AssetFilter, PortfolioData, ANNUALIZE_FACTORS

logger = logging.getLogger(__name__)

_FILTER_TO_ASSET_TYPES: Dict[AssetFilter, List[AssetType]] = {
    AssetFilter.CRYPTO: [AssetType.CRYPTO],
    AssetFilter.STOCKS: [AssetType.STOCK],
    AssetFilter.ALL: [AssetType.CRYPTO, AssetType.STOCK],
}

_MAX_FFILL_GAP = 3
_HISTORY_FETCH_DAYS = 400


class AnalyticsDataProvider:
    """Loads user assets, fetches historical prices, and aligns time series."""

    def __init__(self) -> None:
        self._market_data = MarketDataService()

    async def get_portfolio_data(
        self,
        db: AsyncSession,
        user_id: int,
        asset_filter: AssetFilter = AssetFilter.ALL,
    ) -> PortfolioData:
        assets = await self._load_user_assets(db, user_id, asset_filter)
        if not assets:
            return self._empty(asset_filter)

        prices_df = await self._load_prices(db, [a.symbol for a in assets])
        if prices_df.empty:
            return self._empty(asset_filter)

        prices_df = self._align(prices_df)
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

    async def _load_prices(self, db: AsyncSession, symbols: List[str]) -> pd.DataFrame:
        series: Dict[str, pd.Series] = {}
        for symbol in symbols:
            try:
                await self._market_data.fetch_and_store_history(db, symbol, period="2y")
                candles = await self._market_data.get_candles(db, symbol, days=_HISTORY_FETCH_DAYS)
                if candles:
                    dates = [c.timestamp for c in candles]
                    closes = [float(c.close) for c in candles]
                    series[symbol] = pd.Series(closes, index=pd.DatetimeIndex(dates))
            except Exception as e:
                logger.error(f"Failed to load price data for {symbol}: {e}")
        if not series:
            return pd.DataFrame()
        return pd.DataFrame(series).sort_index()

    @staticmethod
    def _align(df: pd.DataFrame) -> pd.DataFrame:
        """Intersection + limited forward-fill for date alignment."""
        return df.ffill(limit=_MAX_FFILL_GAP).dropna()

    @staticmethod
    def _compute_weights(assets: List[UnifiedAsset], prices_df: pd.DataFrame) -> Tuple[np.ndarray, float]:
        last_prices = prices_df.iloc[-1]
        values = [float(last_prices.get(a.symbol, 0)) * float(a.amount) for a in assets]
        total = sum(values)
        if total <= 0:
            n = len(assets)
            return np.ones(n) / n, 0.0
        return np.array([v / total for v in values]), total

    @staticmethod
    def _annualize_factor(asset_filter: AssetFilter, trading_days: int, index: pd.DatetimeIndex) -> float:
        if asset_filter in ANNUALIZE_FACTORS:
            return float(ANNUALIZE_FACTORS[asset_filter])
        if trading_days < 2 or len(index) < 2:
            return float(np.sqrt(252))
        calendar_days = (index[-1] - index[0]).days
        if calendar_days <= 0:
            return float(np.sqrt(252))
        return float(np.sqrt(trading_days / (calendar_days / 365.25)))

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
