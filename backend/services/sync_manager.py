"""Portfolio synchronization manager and task orchestrator."""

import datetime
from typing import Optional, Dict, Any
import redis.asyncio as redis
from celery.result import AsyncResult
from worker.celery_app import celery_app


class SyncManager:
    """Manages portfolio synchronization tasks.

    Including:
    - Triggering Celery tasks
    - Enforcing cooldown periods (rate limiting)
    - checking task status.
    """

    COOLDOWN_SECONDS = 30  # 30 seconds for testing/debug (User Request)
    AUTO_SYNC_INTERVAL = 600  # 10 minutes for auto-refresh (User Request)
    REDIS_PREFIX = "sync_cooldown:"

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    def _get_cooldown_key(self, user_id: int) -> str:
        return f"{self.REDIS_PREFIX}{user_id}"

    async def get_remaining_cooldown(self, user_id: int) -> int:
        """Returns the number of seconds remaining in the cooldown period.

        Returns 0 if no cooldown is active.
        """
        ttl = await self.redis.ttl(self._get_cooldown_key(user_id))
        return max(0, ttl)

    async def can_trigger_sync(self, user_id: int) -> bool:
        """Checks if a sync can be triggered for this user."""
        remaining = await self.get_remaining_cooldown(user_id)
        return remaining == 0

    async def trigger_sync(self, user_id: int, integration_id: str) -> str:
        """Triggers the sync task and sets the cooldown.

        Returns the task_id.
        """
        # 1. Trigger Task (Using name to avoid circular import)
        task = celery_app.send_task("sync_integration_data", args=[str(integration_id)])

        # 2. Set Cooldown (only if enabled)
        if self.COOLDOWN_SECONDS > 0:
            await self.redis.setex(
                self._get_cooldown_key(user_id), self.COOLDOWN_SECONDS, "active"
            )

        # 3. Set Active Task (for persistence)
        # Expires after 5 minutes just in case
        await self.redis.setex(f"sync_active_task:{user_id}", 300, task.id)

        return task.id

    async def get_active_task(self, user_id: int) -> Optional[str]:
        """Returns the task_id of the currently running sync, if any."""
        # Use get which returns bytes (or str if decode_responses=True),
        # but redis.asyncio with decode_responses=True returns str.
        task_id = await self.redis.get(f"sync_active_task:{user_id}")
        return str(task_id) if task_id else None

    async def clear_active_task(self, user_id: int):
        """Clears the active task flag."""
        await self.redis.delete(f"sync_active_task:{user_id}")

    async def set_last_sync_time(self, user_id: int):
        """Sets the timestamp of the last successful sync."""
        now_ts = datetime.datetime.now(datetime.timezone.utc).timestamp()
        await self.redis.set(f"sync_last_time:{user_id}", str(now_ts))

    async def get_last_sync_time(self, user_id: int) -> Optional[datetime.datetime]:
        """Returns the last successful sync time."""
        ts = await self.redis.get(f"sync_last_time:{user_id}")
        if ts:
            return datetime.datetime.fromtimestamp(float(ts), tz=datetime.timezone.utc)
        return None

    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Wrapper around Celery AsyncResult to return clean status.

        Note: Checking celery status is typically synchronous (checking backend).
        If we wanted fully async, we'd need an async celery backend client,
        but for simple status checks, the blocking is usually minimal (ms).
        However, to be ultra-safe, we keep this method synchronous for now
        as Celery's AsyncResult isn't natively async-awaitable in the way Redis is.
        The blocking call is to the result backend (Redis).
        """
        task_result = AsyncResult(task_id, app=celery_app)
        return {
            "task_id": task_id,
            "status": task_result.status,
            "result": task_result.result if task_result.ready() else None,
            "info": task_result.info
            if isinstance(task_result.info, dict)
            else str(task_result.info),
        }
