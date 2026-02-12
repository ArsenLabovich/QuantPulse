"""
Distributed Lock Manager — атомарные Redis-блокировки.

Решает проблему TOCTOU (Time-of-Check-Time-of-Use):
- acquire() использует SET NX PX (атомарная операция)
- release() использует Lua-скрипт для проверки owner + удаления
- Каждый lock идентифицируется уникальным token, предотвращающим чужой unlock

Использование:
    lock = DistributedLock(redis_client, "my_resource", ttl_sec=30)
    if await lock.acquire():
        try:
            ... # critical section
        finally:
            await lock.release()

    # Или через контекстный менеджер:
    async with DistributedLock(redis_client, "my_resource") as lock:
        if lock.acquired:
            ... # critical section
"""

import uuid
import asyncio
import logging
from typing import Optional

from redis import Redis

from core.config import settings

logger = logging.getLogger(__name__)


# Lua-скрипт: Удаляем ключ ТОЛЬКО если value совпадает с нашим token.
# Это предотвращает ситуацию, когда Worker A отпускает lock Worker B
# потому что TTL истек и B перехватил lock.
_RELEASE_SCRIPT = """
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
end
return 0
"""

# Lua-скрипт: Продлеваем TTL ТОЛЬКО если мы всё ещё owner.
_EXTEND_SCRIPT = """
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("PEXPIRE", KEYS[1], ARGV[2])
end
return 0
"""


class DistributedLock:
    """
    Redis-based distributed lock с owner verification.

    Каждый экземпляр генерирует уникальный token при acquire().
    Только владелец token может выполнить release() или extend().
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
        """
        Попытка захватить lock с ожиданием до timeout_sec.
        """
        eff_timeout = timeout_sec if timeout_sec is not None else settings.DLOCK_DEFAULT_TIMEOUT_SEC
        eff_retry = retry_interval_sec if retry_interval_sec is not None else settings.DLOCK_RETRY_INTERVAL_SEC

        self._token = str(uuid.uuid4())
        deadline = asyncio.get_event_loop().time() + eff_timeout

        while asyncio.get_event_loop().time() < deadline:
            # SET key token NX PX ttl — атомарная операция
            result = self._redis.set(
                self._key,
                self._token,
                nx=True,   # Только если ключ НЕ существует
                px=self._ttl_ms,  # TTL в миллисекундах
            )

            if result:
                self._acquired = True
                logger.debug(f"Lock acquired: {self._key} (token={self._token[:8]}...)")
                return True

            # Lock занят — ждём и пробуем снова
            await asyncio.sleep(eff_retry)

        logger.warning(f"Lock acquire timeout: {self._key} after {eff_timeout}s")
        self._token = None
        return False

    async def release(self) -> bool:
        """
        Освобождает lock ТОЛЬКО если мы являемся владельцем.

        Использует Lua-скрипт для атомарной проверки owner + удаления.
        Это предотвращает ситуацию, когда:
        1. Worker A держит lock
        2. TTL истекает
        3. Worker B захватывает lock
        4. Worker A пытается release() → БЕЗ Lua он удалил бы lock Worker B!

        Returns:
            True если lock был нашим и мы его отпустили.
        """
        if not self._token:
            return False

        result = self._redis.eval(
            _RELEASE_SCRIPT,
            1,           # Количество KEYS
            self._key,   # KEYS[1]
            self._token, # ARGV[1]
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
        """
        Продлевает TTL lock'а, если мы всё ещё owner.

        Полезно для долгих операций, чтобы lock не истёк преждевременно.
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
    """
    Фабрика для создания именованных DistributedLock.

    Инкапсулирует Redis-клиент и предоставляет
    чистый интерфейс для получения lock по имени ресурса.
    """

    def __init__(self, redis_client: Redis):
        self._redis = redis_client

    def sync_lock(self, user_id: int, integration_id: str, ttl_sec: Optional[int] = None) -> DistributedLock:
        """Lock для синхронизации конкретной интеграции."""
        return DistributedLock(
            self._redis,
            f"sync:{user_id}:{integration_id}",
            ttl_sec=ttl_sec if ttl_sec is not None else settings.SYNC_LOCK_TTL_SEC,
        )

    def snapshot_lock(self, user_id: int, ttl_sec: Optional[int] = None) -> DistributedLock:
        """Lock для создания portfolio snapshot пользователя."""
        return DistributedLock(
            self._redis,
            f"snapshot:{user_id}",
            ttl_sec=ttl_sec if ttl_sec is not None else settings.SNAPSHOT_LOCK_TTL_SEC,
        )
