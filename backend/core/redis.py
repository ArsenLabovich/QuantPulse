"""Centralized Redis Client — Async."""

import asyncio
from typing import Dict
import redis.asyncio as redis
from core.config import settings

# Cache clients per event loop to avoid "Future attached to a different loop"
_client_cache: Dict[asyncio.AbstractEventLoop, redis.Redis] = {}


def get_redis_client() -> redis.Redis:
    """Returns a loop-aware async Redis client.

    Ensures that for each event loop (especially in Celery workers),
    we have a dedicated connection pool.
    """
    loop = asyncio.get_event_loop()
    if loop not in _client_cache:
        _client_cache[loop] = redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    return _client_cache[loop]


async def close_redis_client():
    """Closes and removes the Redis client for the current event loop."""
    loop = asyncio.get_event_loop()
    if loop in _client_cache:
        client = _client_cache.pop(loop)
        if hasattr(client, "aclose"):
            await client.aclose()
        elif hasattr(client, "close"):
            await client.close()
