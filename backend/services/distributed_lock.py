"""Distributed Lock Manager — atomic Redis locks.

Solves the TOCTOU (Time-of-Check-Time-of-Use) problem:
- acquire() uses SET NX PX (atomic operation)
- release() uses a Lua script for owner verification + deletion
- Each lock is identified by a unique token preventing accidental unlock by others

Usage:
    lock = DistributedLock(redis_client, "my_resource", ttl_sec=30)
    if await lock.acquire():
        try:
            ... # critical section
        finally:
            await lock.release()

    # Or via context manager:
    async with DistributedLock(redis_client, "my_resource") as lock:
        if lock.acquired:
            ... # critical section
"""

import uuid
import asyncio
import logging
from typing import Optional

from redis.asyncio import Redis

from core.config import settings

logger = logging.getLogger(__name__)


# Lua script: Delete key ONLY if value matches our token.
# This prevents a situation where Worker A releases Worker B's lock
# because the TTL expired and B acquired the lock.
_RELEASE_SCRIPT = """
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
end
return 0
"""

# Lua script: Extend TTL ONLY if we are still the owner.
_EXTEND_SCRIPT = """
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("PEXPIRE", KEYS[1], ARGV[2])
end
return 0
"""


class DistributedLock:
    """Redis-based distributed lock with owner verification.

    Each instance generates a unique token during acquire().
    Only the token owner can perform release() or extend().
    """

    def __init__(
        self,
        redis_client: Redis,
        resource_name: str,
        ttl_sec: Optional[int] = None,
    ):
        self._redis = redis_client
        self._key = f"dlock:{resource_name}"
        effective_ttl = ttl_sec if ttl_sec is not None else settings.SYNC_LOCK_TTL_SEC
        self._ttl_ms = effective_ttl * 1000
        self._token: Optional[str] = None
        self._acquired = False

    @property
    def acquired(self) -> bool:
        return self._acquired

    @property
    def key(self) -> str:
        return self._key

    async def acquire(
        self,
        timeout_sec: Optional[float] = None,
        retry_interval_sec: Optional[float] = None,
    ) -> bool:
        """Attempts to acquire the lock with a wait up to timeout_sec using Pub/Sub."""
        eff_timeout = (
            timeout_sec
            if timeout_sec is not None
            else settings.DLOCK_DEFAULT_TIMEOUT_SEC
        )
        # retry_interval_sec is now used only for fallback polling/jitter

        self._token = str(uuid.uuid4())
        deadline = asyncio.get_event_loop().time() + eff_timeout
        channel_name = f"dlock:channel:{self._key}"

        # 1. Optimistic first try
        if await self._try_acquire():
            return True

        # 2. Wait with Pub/Sub
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(channel_name)

        try:
            while asyncio.get_event_loop().time() < deadline:
                # Try to acquire
                if await self._try_acquire():
                    return True

                # Wait for notification or timeout
                remaining = deadline - asyncio.get_event_loop().time()
                if remaining <= 0:
                    break

                # Wait for message with timeout
                try:
                    message = await pubsub.get_message(
                        ignore_subscribe_messages=True, timeout=remaining
                    )
                    if message:
                        # Someone released the lock, try to acquire immediately
                        continue
                except asyncio.TimeoutError:
                    break

                # Small sleep to prevent tight loop if pubsub fails or spurious wakeups
                await asyncio.sleep(0.05)

        finally:
            await pubsub.unsubscribe(channel_name)
            await pubsub.close()

        logger.warning(f"Lock acquire timeout: {self._key} after {eff_timeout}s")
        self._token = None
        return False

    async def _try_acquire(self) -> bool:
        """Atomic SET NX PX helper."""
        result = await self._redis.set(
            self._key,
            self._token,
            nx=True,
            px=self._ttl_ms,
        )
        if result:
            self._acquired = True
            logger.debug(f"Lock acquired: {self._key}")
            return True
        return False

    async def release(self) -> bool:
        """Releases the lock and notifies waiters via Pub/Sub."""
        if not self._token:
            return False

        # Release Script + Publish Notification
        # KEYS[1] = lock_key, ARGV[1] = token, ARGV[2] = channel_name
        _RELEASE_PUBLISH_SCRIPT = """
        if redis.call("GET", KEYS[1]) == ARGV[1] then
            local del_res = redis.call("DEL", KEYS[1])
            if del_res == 1 then
                redis.call("PUBLISH", ARGV[2], "RELEASED")
            end
            return del_res
        end
        return 0
        """

        channel_name = f"dlock:channel:{self._key}"
        result = await self._redis.eval(
            _RELEASE_PUBLISH_SCRIPT, 1, self._key, self._token, channel_name
        )

        released = bool(result)
        if released:
            logger.debug(f"Lock released: {self._key}")
        else:
            logger.warning(f"Lock release failed (not owner or expired): {self._key}")

        self._acquired = False
        self._token = None
        return released

    async def extend(self, additional_sec: int = 10) -> bool:
        """Extends the lock TTL if we are still the owner.

        Useful for long operations to prevent premature lock expiration.
        """
        if not self._token:
            return False

        additional_ms = additional_sec * 1000
        result = self._redis.eval(
            _EXTEND_SCRIPT,
            1,
            self._key,
            self._token,
            str(additional_ms),
        )
        extended = bool(result)
        if extended:
            logger.debug(f"Lock extended by {additional_sec}s: {self._key}")
        return extended

    # --- Context Manager ---

    async def __aenter__(self) -> "DistributedLock":
        await self.acquire()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        if self._acquired:
            await self.release()


class LockManager:
    """Factory for creating named DistributedLocks.

    Encapsulates the Redis client and provides
    a clean interface for obtaining a lock by resource name.
    """

    def __init__(self, redis_client: Redis):
        self._redis = redis_client

    def sync_lock(
        self, user_id: int, integration_id: str, ttl_sec: Optional[int] = None
    ) -> DistributedLock:
        """Lock for syncing a specific integration."""
        return DistributedLock(
            self._redis,
            f"sync:{user_id}:{integration_id}",
            ttl_sec=ttl_sec if ttl_sec is not None else settings.SYNC_LOCK_TTL_SEC,
        )

    def snapshot_lock(
        self, user_id: int, ttl_sec: Optional[int] = None
    ) -> DistributedLock:
        """Lock for creating a user's portfolio snapshot."""
        return DistributedLock(
            self._redis,
            f"snapshot:{user_id}",
            ttl_sec=ttl_sec if ttl_sec is not None else settings.SNAPSHOT_LOCK_TTL_SEC,
        )
