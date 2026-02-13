"""Centralized Redis Client — Async."""

from typing import Optional
import redis.asyncio as redis
from core.config import settings

# Global async client
_redis_client: Optional[redis.Redis] = None


def get_redis_client() -> redis.Redis:
    """Returns the global async Redis client.

    Ensures a single connection pool is shared across the application.
    """
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.REDIS_URL, encoding="utf-8", decode_responses=True
        )
    return _redis_client


async def close_redis_client():
    """Closes the Redis connection pool."""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
