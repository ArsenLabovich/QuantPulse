"""Portfolio Snapshot Service — orchestrates the creation of portfolio snapshots.

Responsible for:
1. Completeness check (ensures all integrations are synced)
2. Deduplication (45-second window to prevent snapshot spam)
3. Atomic snapshot creation/update
4. Use of DistributedLock to prevent race conditions

Extracted from tasks.py following the Single Responsibility Principle (SRP).
"""

import datetime
import logging
from typing import Optional, Dict, Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.assets import UnifiedAsset, PortfolioSnapshot
from models.integration import Integration
from services.distributed_lock import LockManager
from core.config import settings

logger = logging.getLogger(__name__)

# --- Constants removed and moved to config.py ---


class SnapshotService:
    """Service for creating Portfolio Snapshots.

    Guarantees:
    - Snapshot is created ONLY when data from all integrations is committed
    - Only ONE snapshot per user within the deduplication window
    - Partial snapshots are NOT recorded (prevents gaps in the chart)
    """

    def __init__(self, lock_manager: LockManager):
        self._lock_manager = lock_manager

    async def create_or_update_snapshot(
        self,
        db: AsyncSession,
        user_id: int,
        new_assets_count: int,
    ) -> Optional[PortfolioSnapshot]:
        """Creates or updates a portfolio snapshot for the user.

        This method should be called ONLY AFTER
        integration data has already been committed to the DB.

        Args:
            db: Async database session (must be NEW, not from the same transaction)
            user_id: User ID
            new_assets_count: Asset count in the latest sync

        Returns:
            PortfolioSnapshot if created/updated, None if skipped.
        """
        lock = self._lock_manager.snapshot_lock(user_id)

        if not await lock.acquire(timeout_sec=settings.SNAPSHOT_LOCK_TIMEOUT_SEC):
            logger.warning(f"Snapshot lock timeout for user {user_id}. Skipping.")
            return None

        try:
            return await self._create_snapshot_under_lock(db, user_id, new_assets_count)
        finally:
            await lock.release()

    async def _create_snapshot_under_lock(
        self,
        db: AsyncSession,
        user_id: int,
        new_assets_count: int,
    ) -> Optional[PortfolioSnapshot]:
        """Internal snapshot creation logic running under a lock."""
        # 1. Check completeness — ensure all integrations have been synced
        completeness = await self._check_completeness(db, user_id)

        if completeness["is_partial"]:
            logger.info(
                f"Skipping snapshot for user {user_id}: "
                f"Partial data ({completeness['synced_count']}/{completeness['total_count']} integrations)."
            )
            return None

        # 2. Calculate current net worth
        net_worth = await self._calculate_net_worth(db, user_id)

        if net_worth is None or net_worth < 0:
            logger.warning(f"Invalid net worth for user {user_id}: {net_worth}")
            return None

        # 3. Deduplication — look for a recent snapshot within the window
        existing = await self._find_recent_snapshot(db, user_id)

        # 4. Form metadata
        snapshot_data: Dict[str, Any] = {
            "asset_count": new_assets_count,
            "source": "worker_sync",
            "integrations_count": completeness["synced_count"],
            "total_integrations": completeness["total_count"],
            "is_partial": False,
        }

        # 5. Create or update
        if existing:
            snapshot = await self._update_existing_snapshot(existing, net_worth, snapshot_data)
        else:
            snapshot = self._create_new_snapshot(db, user_id, net_worth, snapshot_data)

        await db.commit()
        logger.info(f"Snapshot {'updated' if existing else 'created'} for user {user_id}: ${float(net_worth):,.2f}")
        return snapshot

    # --- Private Helpers ---

    async def _check_completeness(self, db: AsyncSession, user_id: int) -> Dict[str, Any]:
        """Checks if all of the user's active integrations have data in unified_assets.

        Returns:
            Dict with keys: total_count, synced_count, is_partial
        """
        # Number of active integrations
        total_result = await db.execute(
            select(func.count(Integration.id)).where(
                Integration.user_id == user_id,
                Integration.is_active == True,  # noqa: E712
            )
        )
        total_count = total_result.scalar() or 0

        # Number of integrations that have data in unified_assets
        synced_result = await db.execute(
            select(func.count(func.distinct(UnifiedAsset.integration_id))).where(UnifiedAsset.user_id == user_id)
        )
        synced_count = synced_result.scalar() or 0

        return {
            "total_count": total_count,
            "synced_count": synced_count,
            "is_partial": synced_count < total_count,
        }

    async def _calculate_net_worth(self, db: AsyncSession, user_id: int) -> Optional[float]:
        """Calculates the total USD value of all the user's assets."""
        result = await db.execute(select(func.sum(UnifiedAsset.usd_value)).where(UnifiedAsset.user_id == user_id))
        value = result.scalar()
        return float(value) if value is not None else None

    async def _find_recent_snapshot(self, db: AsyncSession, user_id: int) -> Optional[PortfolioSnapshot]:
        """Searches for a snapshot within the deduplication window."""
        cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
            seconds=settings.SNAPSHOT_DEDUP_WINDOW_SEC
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
        """Updates an existing snapshot."""
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
        """Creates a new snapshot."""
        snapshot = PortfolioSnapshot(
            user_id=user_id,
            total_value_usd=net_worth,
            data=data,
        )
        db.add(snapshot)
        return snapshot
