"""Read/write layer for analytics results (Redis + PostgreSQL)."""

import json
import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from models.analytics_result import AnalyticsResult
from services.analytics.base import MetricResult, AssetFilter

logger = logging.getLogger(__name__)

_CACHE_TTL = 300  # 5 minutes
_CACHE_PREFIX = "analytics"


def _cache_key(user_id: int, metric: str, asset_filter: str) -> str:
    return f"{_CACHE_PREFIX}:{user_id}:{metric}:{asset_filter}"


class AnalyticsResultStore:
    """Handles persistence of metric results to Redis (cache) and PostgreSQL (storage)."""

    async def save(
        self,
        db: AsyncSession,
        redis_client,
        user_id: int,
        result: MetricResult,
        asset_filter: AssetFilter,
    ) -> None:
        await self._save_to_db(db, user_id, result, asset_filter)
        await self._save_to_cache(redis_client, user_id, result, asset_filter)

    async def get_cached(self, redis_client, user_id: int, metric: str, asset_filter: str) -> Optional[dict]:
        key = _cache_key(user_id, metric, asset_filter)
        try:
            raw = await redis_client.get(key)
            if raw:
                return json.loads(raw)
        except Exception as e:
            logger.warning(f"Redis cache read failed: {e}")
        return None

    async def get_from_db(self, db: AsyncSession, user_id: int, metric: str, asset_filter: str) -> Optional[dict]:
        result = await db.execute(
            select(AnalyticsResult).where(
                AnalyticsResult.user_id == user_id,
                AnalyticsResult.metric_name == metric,
                AnalyticsResult.asset_filter == asset_filter,
            )
        )
        row = result.scalars().first()
        if not row:
            return None
        return {
            "name": row.metric_name,
            "value": float(row.value) if row.value else None,
            "display_value": row.display_value,
            "status": row.status,
            "confidence": row.confidence,
            "meta": row.meta or {},
            "computed_at": row.computed_at.isoformat() if row.computed_at else None,
        }

    async def _save_to_db(
        self, db: AsyncSession, user_id: int, result: MetricResult, asset_filter: AssetFilter
    ) -> None:
        stmt = insert(AnalyticsResult).values(
            user_id=user_id,
            metric_name=result.name,
            asset_filter=asset_filter.value,
            value=result.value,
            display_value=result.display_value,
            status=result.status,
            confidence=result.confidence.value if result.confidence else None,
            meta=result.meta,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_user_metric_filter",
            set_={
                "value": stmt.excluded.value,
                "display_value": stmt.excluded.display_value,
                "status": stmt.excluded.status,
                "confidence": stmt.excluded.confidence,
                "meta": stmt.excluded.meta,
                "computed_at": stmt.excluded.computed_at,
            },
        )
        await db.execute(stmt)
        await db.commit()

    async def _save_to_cache(self, redis_client, user_id: int, result: MetricResult, asset_filter: AssetFilter) -> None:
        key = _cache_key(user_id, result.name, asset_filter.value)
        try:
            await redis_client.set(key, json.dumps(result.to_dict()), ex=_CACHE_TTL)
        except Exception as e:
            logger.warning(f"Redis cache write failed: {e}")
