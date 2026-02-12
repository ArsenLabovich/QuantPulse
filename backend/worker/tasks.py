import asyncio
import json
import logging
import datetime
import sys
import os

# Ensure backend root is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from uuid import UUID
import ccxt
from sqlalchemy import select, delete, func

from worker.celery_app import celery_app
from core.database import DATABASE_URL, get_async_sessionmaker, get_async_engine, dispose_loop_engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from redis import Redis
import time

from models.assets import UnifiedAsset, AssetType, PortfolioSnapshot
from models.integration import Integration, ProviderID
from models.user import User
from core.security.encryption import encryption_service
from core.config import settings
from services.currency import currency_service
from services.price_service import PriceTrackingService
from services.distributed_lock import LockManager
from services.snapshot_service import SnapshotService


logger = logging.getLogger(__name__)

# --- Infrastructure ---
redis_client = Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))
lock_manager = LockManager(redis_client)
snapshot_service = SnapshotService(lock_manager)


async def sync_integration_data_async(integration_id: str, task_instance=None):
    """
    Syncs data for a single integration.

    Guarantees:
    - Only one sync per integration at a time (DistributedLock)
    - Asset DELETE + INSERT operations are atomic (single transaction)
    - Portfolio Snapshot is created ONLY AFTER data commit
    """
    logger.info(f"Starting sync for integration {integration_id}")
    _update_progress(task_instance, 5, "INIT", "Initializing sync...")

    session_factory = get_async_sessionmaker()
    try:
        # 1. Fetch Integration & Decrypt Credentials
        integration, creds = await _load_integration(
            session_factory, integration_id
        )
        if integration is None or creds is None:
            return

        user_id = integration.user_id

        # 2. Acquire Sync Lock (atomic SET NX — eliminates RC-2)
        sync_lock = lock_manager.sync_lock(
            user_id, integration_id, ttl_sec=settings.SYNC_LOCK_TTL_SEC
        )

        if not await sync_lock.acquire(timeout_sec=settings.SYNC_WAIT_MAX_SEC):
            # Another task completed the sync while we were waiting
            logger.info(
                f"Sync lock wait expired for user {user_id}. "
                f"Assuming parallel task completed."
            )
            _update_progress(task_instance, 100, "DONE", "Synced (via parallel task)")
            return

        try:
            await _run_sync(
                session_factory, integration, creds, task_instance
            )
        finally:
            await sync_lock.release()

    finally:
        # Crucial for Celery + Asyncio: dispose the engine for the CURRENT loop
        # to prevent cross-loop contamination and memory leaks.
        await dispose_loop_engine()


async def _load_integration(session_factory, integration_id: str):
    """
    Loads the integration from the DB and decrypts credentials.

    Returns:
        (Integration, dict) or (None, None) on error.
    """
    async with session_factory() as db:
        result = await db.execute(
            select(Integration).where(Integration.id == UUID(integration_id))
        )
        integration = result.scalar_one_or_none()

        if not integration:
            logger.error(f"Integration {integration_id} not found")
            return None, None

        if integration.provider_id not in [
            ProviderID.binance, ProviderID.trading212, ProviderID.freedom24
        ]:
            logger.warning(
                f"Provider {integration.provider_id} not supported for sync yet"
            )
            return None, None

        try:
            decrypted_json = encryption_service.decrypt(integration.credentials)
            creds = json.loads(decrypted_json)
        except Exception as e:
            logger.error(f"Failed to decrypt credentials: {e}")
            return None, None

        return integration, creds


async def _run_sync(session_factory, integration, creds, task_instance):
    """
    Executes the main sync logic:
    1. Fetch data via Adapter
    2. Atomic DELETE + INSERT in a single transaction (eliminates RC-4)
    3. Snapshot AFTER commit (eliminates RC-1 and RC-3)
    """
    user_id = integration.user_id

    # --- Phase 1: Fetch Data from External API ---
    _update_progress(task_instance, 20, "FETCHING", "Fetching data from exchange...")

    from adapters.factory import AdapterFactory
    try:
        adapter = AdapterFactory.get_adapter(integration.provider_id)
        assets_data = await adapter.fetch_balances(creds, integration.settings)
    except Exception as e:
        logger.error(f"Adapter Sync Error: {e}")
        # Mark as progress 0 before raising so UI sees it started but failed
        _update_progress(task_instance, 0, "ERROR", str(e))
        raise  # Let Celery handle the exception properly

    # --- Phase 2: Transform & Prepare ---
    _update_progress(
        task_instance, 60, "PROCESSING", f"Processing {len(assets_data)} assets..."
    )

    new_assets = []
    total_portfolio_value = 0.0

    # Use a separate session for price tracking (doesn't affect the main transaction)
    async with session_factory() as price_db:
        for ad in assets_data:
            rate = await currency_service.get_rate(ad.currency, settings.BASE_CURRENCY)
            price_native = float(ad.price)
            price_usd = price_native * rate
            usd_value = float(ad.amount) * price_usd
            total_portfolio_value += usd_value

            # Price history (separate operation, doesn't block the main transaction)
            await PriceTrackingService.record_price(
                price_db, ad.symbol, integration.provider_id, price_usd, settings.BASE_CURRENCY
            )
            calculated_change = await PriceTrackingService.calculate_24h_change(
                price_db, ad.symbol, integration.provider_id, price_usd
            )

            asset = UnifiedAsset(
                user_id=user_id,
                integration_id=integration.id,
                symbol=ad.symbol,
                name=ad.name,
                original_name=ad.original_symbol or ad.symbol,
                asset_type=ad.asset_type,
                amount=ad.amount,
                currency=ad.currency,
                current_price=ad.price,
                change_24h=calculated_change,
                usd_value=usd_value,
                image_url=ad.image_url,
            )
            new_assets.append(asset)

        await price_db.commit()

    # --- Phase 3: Atomic Write (DELETE + INSERT in a single transaction) ---
    # This eliminates RC-4: the frontend NEVER sees an empty list,
    # because DELETE and INSERT are committed SIMULTANEOUSLY.
    _update_progress(task_instance, 85, "SAVING", "Saving to database...")

    async with session_factory() as db:
        async with db.begin():
            await db.execute(
                delete(UnifiedAsset).where(
                    UnifiedAsset.integration_id == integration.id
                )
            )
            if new_assets:
                db.add_all(new_assets)
            # auto-commit on exit from begin()

    logger.info(
        f"Committed {len(new_assets)} assets for integration "
        f"{integration.id}. Total: ${total_portfolio_value:,.2f}"
    )

    # --- Phase 4: Snapshot (AFTER commit — eliminates RC-1 and RC-3) ---
    # Data is now GUARANTEED to be visible to other sessions.
    _update_progress(task_instance, 92, "SNAPSHOT", "Creating portfolio snapshot...")

    async with session_factory() as snapshot_db:
        await snapshot_service.create_or_update_snapshot(
            snapshot_db, user_id, len(new_assets)
        )

    # --- Phase 5: Finalize ---
    redis_client.set(f"sync_last_time:{user_id}", str(time.time()))
    _update_progress(task_instance, 100, "DONE", "Sync complete")
    logger.info(
        f"Successfully synced {len(new_assets)} assets. "
        f"Total Value: ${total_portfolio_value:,.2f}"
    )


def _update_progress(task_instance, current: int, stage: str, message: str):
    """Helper for updating Celery task state."""
    if not task_instance:
        return

    task_instance.update_state(
        state="PROGRESS",
        meta={
            "current": current,
            "total": 100,
            "stage": stage,
            "message": message,
        },
    )


# === Celery Task Wrappers ===


@celery_app.task(bind=True, name="sync_integration_data")
def sync_integration_data(self, integration_id: str):
    """Celery task wrapper for async sync logic."""
    asyncio.run(sync_integration_data_async(integration_id, self))


@celery_app.task(name="trigger_global_sync")
def trigger_global_sync():
    """
    Scheduled task to trigger sync for ALL active integrations.
    Dispatches individual sync tasks for each integration.
    """
    logger.info("⏰ Global Sync: Starting scheduled update for all users...")

    async def dispatch_all():
        engine = get_async_engine()
        async with engine.connect() as conn:
            result = await conn.execute(
                select(Integration.id).where(Integration.is_active == True)  # noqa: E712
            )
            ids = result.scalars().all()
            logger.info(f"⏰ Global Sync: Found {len(ids)} integrations to update.")

            for int_id in ids:
                sync_integration_data.delay(str(int_id))

        await dispose_loop_engine()

    asyncio.run(dispatch_all())


@celery_app.task(name="cleanup_price_history")
def cleanup_price_history():
    """Scheduled task to remove market price history older than 48 hours."""
    logger.info("🧹 Starting price history cleanup...")

    from sqlalchemy import delete as sa_delete
    from models.assets import MarketPriceHistory

    async def run_cleanup():
        engine = get_async_engine()
        async with engine.begin() as conn:
            cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
                hours=settings.PRICE_HISTORY_KEEP_HOURS
            )
            result = await conn.execute(
                sa_delete(MarketPriceHistory).where(
                    MarketPriceHistory.timestamp < cutoff
                )
            )
            logger.info(f"Deleted {result.rowcount} old price history records.")

        await dispose_loop_engine()

    asyncio.run(run_cleanup())
