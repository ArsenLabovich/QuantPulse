"""Analytics API Router."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_user
from core.redis import get_redis_client
from models.user import User
from services.analytics.base import AssetFilter
from services.analytics.data_provider import AnalyticsDataProvider
from services.analytics.calculators.volatility import VolatilityCalculator
from services.analytics.result_store import AnalyticsResultStore

router = APIRouter(prefix="/analytics", tags=["analytics"])

_STUB = {"value": None, "display_value": "--", "status": "pending", "confidence": None, "meta": {}}

_data_provider = AnalyticsDataProvider()
_volatility_calc = VolatilityCalculator()
_result_store = AnalyticsResultStore()


@router.get("/summary")
async def get_analytics_summary(
    asset_filter: str = Query("all", pattern="^(all|crypto|stocks)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all metric values. Currently only volatility is live."""
    redis = get_redis_client()
    af = AssetFilter(asset_filter)

    # Try cache first
    cached = await _result_store.get_cached(redis, current_user.id, "volatility", af.value)
    volatility_data = cached or await _compute_and_store_volatility(db, redis, current_user.id, af)

    return {
        "volatility": volatility_data,
        "sharpe_ratio": _STUB,
        "sortino_ratio": _STUB,
        "treynor_ratio": _STUB,
        "monte_carlo_sim": _STUB,
        "risk_var_95": _STUB,
        "max_drawdown": _STUB,
        "beta": _STUB,
        "correlation_status": _STUB,
        "r_squared": _STUB,
    }


@router.get("/metric/{metric_name}")
async def get_metric_detail(
    metric_name: str,
    asset_filter: str = Query("all", pattern="^(all|crypto|stocks)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns detailed data for a single metric."""
    redis = get_redis_client()
    af = AssetFilter(asset_filter)

    if metric_name == "volatility":
        cached = await _result_store.get_cached(redis, current_user.id, "volatility", af.value)
        if cached:
            return cached
        return await _compute_and_store_volatility(db, redis, current_user.id, af)

    return _STUB


async def _compute_and_store_volatility(db: AsyncSession, redis, user_id: int, af: AssetFilter) -> dict:
    """Compute volatility synchronously (fast enough for single metric)."""
    data = await _data_provider.get_portfolio_data(db, user_id, af)
    result = _volatility_calc.calculate(data)
    await _result_store.save(db, redis, user_id, result, af)
    return result.to_dict()
