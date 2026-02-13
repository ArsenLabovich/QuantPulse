"""Portfolio synchronization manager and task orchestrator."""

import datetime
from typing import Optional, Dict, Any
from redis import Redis
from celery.result import AsyncResult
from worker.celery_app import celery_app


class SyncManager:
    """Manages portfolio synchronization tasks.

    Including:
    - Triggering Celery tasks
    - Enforcing cooldown periods (rate limiting)
    - checking task status.
    """

    COOLDOWN_SECONDS = 0  # Disabled by user request
    AUTO_SYNC_INTERVAL = 60  # 1 minute for auto-refresh
    REDIS_PREFIX = "sync_cooldown:"

    def __init__(self, redis_client: Redis):
        self.redis = redis_client

    def _get_cooldown_key(self, user_id: int) -> str:
        return f"{self.REDIS_PREFIX}{user_id}"

    def get_remaining_cooldown(self, user_id: int) -> int:
        """Returns the number of seconds remaining in the cooldown period.

        Returns 0 if no cooldown is active.
        """
        ttl = self.redis.ttl(self._get_cooldown_key(user_id))
        return max(0, ttl)

    def can_trigger_sync(self, user_id: int) -> bool:
        """Checks if a sync can be triggered for this user."""
        return self.get_remaining_cooldown(user_id) == 0

    def trigger_sync(self, user_id: int, integration_id: str) -> str:
        """Triggers the sync task and sets the cooldown.

        Returns the task_id.
        Raises different exceptions? No, assuming caller checked `can_trigger_sync`.
        """
        # 1. Trigger Task (Using name to avoid circular import)
        task = celery_app.send_task("sync_integration_data", args=[str(integration_id)])

        # 2. Set Cooldown (only if enabled)
        if self.COOLDOWN_SECONDS > 0:
            self.redis.setex(self._get_cooldown_key(user_id), self.COOLDOWN_SECONDS, "active")

        # 3. Set Active Task (for persistence)
        # Expires after 5 minutes just in case
        self.redis.setex(f"sync_active_task:{user_id}", 300, task.id)

        return task.id

    def get_active_task(self, user_id: int) -> Optional[str]:
        """Returns the task_id of the currently running sync, if any."""
        # Use get which returns bytes, decode to string
        task_id = self.redis.get(f"sync_active_task:{user_id}")
        return task_id.decode("utf-8") if task_id else None

    def clear_active_task(self, user_id: int):
        """Clears the active task flag."""
        self.redis.delete(f"sync_active_task:{user_id}")

    def set_last_sync_time(self, user_id: int):
        """Sets the timestamp of the last successful sync."""
        now_ts = datetime.datetime.now(datetime.timezone.utc).timestamp()
        self.redis.set(f"sync_last_time:{user_id}", str(now_ts))

    def get_last_sync_time(self, user_id: int) -> Optional[datetime.datetime]:
        """Returns the last successful sync time."""
        ts = self.redis.get(f"sync_last_time:{user_id}")
        if ts:
            return datetime.datetime.fromtimestamp(float(ts), tz=datetime.timezone.utc)
        return None

    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Wrapper around Celery AsyncResult to return clean status."""
        task_result = AsyncResult(task_id, app=celery_app)
        return {
            "task_id": task_id,
            "status": task_result.status,
            "result": task_result.result if task_result.ready() else None,
            "info": task_result.info if isinstance(task_result.info, dict) else str(task_result.info),
        }
