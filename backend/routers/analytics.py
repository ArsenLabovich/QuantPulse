"""Analytics API router for portfolio insights and metric calculations."""

import json
import hashlib
from datetime import date
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_user
from core.redis import get_redis_client
from models.user import User
from services.analytics.base import AssetFilter
from services.analytics.data_provider import AnalyticsDataProvider
from services.analytics.calculators.volatility import VolatilityCalculator
from services.analytics.result_store import AnalyticsResultStore
from worker.tasks import compute_volatility

router = APIRouter(prefix="/analytics", tags=["analytics"])

_STUB = {"value": None, "display_value": "--", "status": "pending", "confidence": None, "meta": {}}

_data_provider = AnalyticsDataProvider()
_volatility_calc = VolatilityCalculator()
_result_store = AnalyticsResultStore()


class VolatilityRequest(BaseModel):
    symbols: List[str]
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    interval: str = "all"  # "1w", "1m", "3m", "1y", "custom"


def _summary_response(volatility_data: dict) -> dict:
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
    if cached:
        return _summary_response(cached)

    # Cache miss -> Check DB
    db_result = await _result_store.get_from_db(db, current_user.id, "volatility", af.value)
    if db_result:
        # DB hit (stale) -> Return immediately + trigger background refresh
        compute_volatility.delay(current_user.id, af.value)
        return _summary_response(db_result)

    # Total miss -> Trigger background + return pending stub
    compute_volatility.delay(current_user.id, af.value)
    return _summary_response(_STUB)


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


@router.post("/volatility/compute")
async def compute_custom_volatility(
    req: VolatilityRequest,
    current_user: User = Depends(get_current_user),
):
    """Dispatches a background volatility computation task.

    Returns the task_id for progress tracking via the /progress endpoint.
    API does NO computation — all work is done in the Celery worker.
    """
    redis = get_redis_client()

    # Create deterministic hash based on symbols, start_date, and end_date
    symbols_str = ",".join(sorted(req.symbols))
    hash_input = f"{symbols_str}|{req.start_date}|{req.end_date}"
    req_hash = hashlib.sha256(hash_input.encode()).hexdigest()
    cache_key = f"analytics:cache:vol:custom:{req_hash}"

    cached_result = await redis.get(cache_key)
    if cached_result:
        return {
            "status": "cached",
            "result": json.loads(cached_result),
        }

    from worker.celery_app import celery_app

    task = celery_app.send_task(
        "compute_volatility_custom",
        args=[
            req.symbols,
            str(req.start_date) if req.start_date else None,
            str(req.end_date) if req.end_date else None,
            req_hash,
        ],
    )
    return {"status": "pending", "task_id": task.id}


@router.get("/volatility/progress/{task_id}")
async def volatility_progress(
    task_id: str,
    request: Request,
):
    """SSE endpoint: relays worker progress from Redis Pub/Sub.

    Subscribes to channel `analytics:progress:{task_id}` and forwards
    every message as an SSE event. Closes when 'done' or 'error' stage
    is received, or when the client disconnects.
    """
    redis = get_redis_client()

    async def event_generator():
        import time

        pubsub = redis.pubsub()
        await pubsub.subscribe(f"analytics:progress:{task_id}")
        start_time = time.monotonic()
        max_sse_secs = 300
        try:
            while True:
                if await request.is_disconnected() or time.monotonic() - start_time > max_sse_secs:
                    break

                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.5)

                if message is None:
                    # No message yet — send keepalive to prevent timeout
                    yield ": keepalive\n\n"
                    continue

                if message["type"] == "message":
                    data = message["data"]
                    yield f"data: {data}\n\n"

                    try:
                        parsed = json.loads(data)
                        if parsed.get("stage") in ("done", "error"):
                            break
                    except json.JSONDecodeError:
                        pass
        finally:
            await pubsub.unsubscribe(f"analytics:progress:{task_id}")
            await pubsub.aclose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _compute_and_store_volatility(db: AsyncSession, redis, user_id: int, af: AssetFilter) -> dict:
    """Compute volatility synchronously (fast enough for single metric)."""
    data = await _data_provider.get_portfolio_data(db, user_id, af)
    result = _volatility_calc.calculate(data)
    await _result_store.save(db, redis, user_id, result, af)
    await db.commit()
    return result.to_dict()
