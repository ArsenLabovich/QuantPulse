"""
Portfolio Snapshot Service — оркестрация создания снимков портфеля.

Отвечает за:
1. Проверку completeness (все ли интеграции синхронизированы)
2. Deduplication (45-секундное окно, чтобы не создавать спам)
3. Атомарное создание/обновление snapshot
4. Использование DistributedLock для предотвращения race conditions

Вынесено из tasks.py согласно SRP (Single Responsibility Principle).
"""

import datetime
import logging
from typing import Optional, Dict, Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.assets import UnifiedAsset, PortfolioSnapshot
from models.integration import Integration
from services.distributed_lock import LockManager

logger = logging.getLogger(__name__)

# --- Constants ---
SNAPSHOT_DEDUP_WINDOW_SEC = 45


class SnapshotService:
    """
    Сервис для создания Portfolio Snapshot.

    Гарантирует:
    - Snapshot создаётся ТОЛЬКО когда данные всех интеграций committed
    - Только ОДИН snapshot на пользователя в пределах dedup-окна
    - Partial snapshots НЕ записываются (предотвращает провалы в графике)
    """

    def __init__(self, lock_manager: LockManager):
        self._lock_manager = lock_manager

    async def create_or_update_snapshot(
        self,
        db: AsyncSession,
        user_id: int,
        new_assets_count: int,
    ) -> Optional[PortfolioSnapshot]:
        """
        Создаёт или обновляет portfolio snapshot для пользователя.

        Этот метод должен вызываться ТОЛЬКО ПОСЛЕ того, как
        данные интеграции уже committed в БД.

        Args:
            db: Async database session (должна быть НОВОЙ, не из той же транзакции)
            user_id: ID пользователя
            new_assets_count: Количество активов в последней синхронизации

        Returns:
            PortfolioSnapshot если создан/обновлён, None если пропущен.
        """
        lock = self._lock_manager.snapshot_lock(user_id)

        if not await lock.acquire(timeout_sec=25):
            logger.warning(f"Snapshot lock timeout for user {user_id}. Skipping.")
            return None

        try:
            return await self._create_snapshot_under_lock(
                db, user_id, new_assets_count
            )
        finally:
            await lock.release()

    async def _create_snapshot_under_lock(
        self,
        db: AsyncSession,
        user_id: int,
        new_assets_count: int,
    ) -> Optional[PortfolioSnapshot]:
        """Внутренняя логика создания snapshot, выполняющаяся под lock."""

        # 1. Проверяем completeness — все ли интеграции синхронизировались
        completeness = await self._check_completeness(db, user_id)

        if completeness["is_partial"]:
            logger.info(
                f"Skipping snapshot for user {user_id}: "
                f"Partial data ({completeness['synced_count']}/{completeness['total_count']} integrations)."
            )
            return None

        # 2. Считаем текущий net worth
        net_worth = await self._calculate_net_worth(db, user_id)

        if net_worth is None or net_worth < 0:
            logger.warning(f"Invalid net worth for user {user_id}: {net_worth}")
            return None

        # 3. Deduplication — ищем свежий snapshot в пределах окна
        existing = await self._find_recent_snapshot(db, user_id)

        # 4. Формируем metadata
        snapshot_data: Dict[str, Any] = {
            "asset_count": new_assets_count,
            "source": "worker_sync",
            "integrations_count": completeness["synced_count"],
            "total_integrations": completeness["total_count"],
            "is_partial": False,
        }

        # 5. Создаём или обновляем
        if existing:
            snapshot = await self._update_existing_snapshot(
                existing, net_worth, snapshot_data
            )
        else:
            snapshot = self._create_new_snapshot(
                db, user_id, net_worth, snapshot_data
            )

        await db.commit()
        logger.info(
            f"Snapshot {'updated' if existing else 'created'} for user {user_id}: "
            f"${float(net_worth):,.2f}"
        )
        return snapshot

    # --- Private Helpers ---

    async def _check_completeness(
        self, db: AsyncSession, user_id: int
    ) -> Dict[str, Any]:
        """
        Проверяет, все ли активные интеграции пользователя
        имеют данные в unified_assets.

        Returns:
            Dict с ключами: total_count, synced_count, is_partial
        """
        # Количество активных интеграций
        total_result = await db.execute(
            select(func.count(Integration.id)).where(
                Integration.user_id == user_id,
                Integration.is_active == True,  # noqa: E712
            )
        )
        total_count = total_result.scalar() or 0

        # Количество интеграций, у которых есть данные в unified_assets
        synced_result = await db.execute(
            select(func.count(func.distinct(UnifiedAsset.integration_id))).where(
                UnifiedAsset.user_id == user_id
            )
        )
        synced_count = synced_result.scalar() or 0

        return {
            "total_count": total_count,
            "synced_count": synced_count,
            "is_partial": synced_count < total_count,
        }

    async def _calculate_net_worth(
        self, db: AsyncSession, user_id: int
    ) -> Optional[float]:
        """Считает суммарную USD-стоимость всех активов пользователя."""
        result = await db.execute(
            select(func.sum(UnifiedAsset.usd_value)).where(
                UnifiedAsset.user_id == user_id
            )
        )
        value = result.scalar()
        return float(value) if value is not None else None

    async def _find_recent_snapshot(
        self, db: AsyncSession, user_id: int
    ) -> Optional[PortfolioSnapshot]:
        """Ищет snapshot в пределах dedup-окна."""
        cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
            seconds=SNAPSHOT_DEDUP_WINDOW_SEC
        )
        result = await db.execute(
            select(PortfolioSnapshot)
            .where(
                PortfolioSnapshot.user_id == user_id,
                PortfolioSnapshot.timestamp >= cutoff,
            )
            .order_by(PortfolioSnapshot.timestamp.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _update_existing_snapshot(
        self,
        snapshot: PortfolioSnapshot,
        net_worth: float,
        data: Dict[str, Any],
    ) -> PortfolioSnapshot:
        """Обновляет существующий snapshot."""
        snapshot.total_value_usd = net_worth
        snapshot.timestamp = datetime.datetime.now(datetime.timezone.utc)
        snapshot.data = data
        return snapshot

    def _create_new_snapshot(
        self,
        db: AsyncSession,
        user_id: int,
        net_worth: float,
        data: Dict[str, Any],
    ) -> PortfolioSnapshot:
        """Создаёт новый snapshot."""
        snapshot = PortfolioSnapshot(
            user_id=user_id,
            total_value_usd=net_worth,
            data=data,
        )
        db.add(snapshot)
        return snapshot
