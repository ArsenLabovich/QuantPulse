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
from core.database import DATABASE_URL
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from redis import Redis
import os
import time

# Redis for locking/dedup
redis_client = Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))

from models.assets import UnifiedAsset, AssetType, PortfolioSnapshot
from models.integration import Integration, ProviderID
from models.user import User
from core.security.encryption import encryption_service
from services.currency import currency_service


logger = logging.getLogger(__name__)

async def sync_integration_data_async(integration_id: str, task_instance=None):
    logger.info(f"Starting sync for integration {integration_id}")
    if task_instance:
        task_instance.update_state(state='PROGRESS', meta={'current': 5, 'total': 100, 'stage': 'INIT', 'message': 'Initializing sync...'})
    
    # Create a local engine/session for this specific asyncio loop to avoid "Attached to different loop" errors
    # caused by sharing the global engine across celery's asyncio.run() calls.
    local_engine = create_async_engine(DATABASE_URL, echo=False)
    LocalAsyncSession = sessionmaker(local_engine, class_=AsyncSession, expire_on_commit=False)

    async with LocalAsyncSession() as db:
        try:
            # 1. Fetch Integration
            result = await db.execute(select(Integration).where(Integration.id == UUID(integration_id)))
            integration = result.scalar_one_or_none()
            
            if not integration:
                logger.error(f"Integration {integration_id} not found")
                return

            if integration.provider_id not in [ProviderID.binance, ProviderID.trading212]:
                logger.warning(f"Provider {integration.provider_id} not supported for sync yet")
                return
            
            # 2. Decrypt Credentials
            try:
                decrypted_json = encryption_service.decrypt(integration.credentials)
                creds = json.loads(decrypted_json)
                api_key = creds.get("api_key")
                api_secret = creds.get("api_secret")
            except Exception as e:
                logger.error(f"Failed to decrypt credentials: {e}")
                return

            # 2.5 Concurrency & Redundancy Check (Smart Lock)
            user_id = integration.user_id
            lock_key = f"sync_lock:{user_id}:{integration_id}"
            last_sync_key = f"sync_last_time:{user_id}"
            
            # A. Check Lock (Is another task running?)
            if redis_client.get(lock_key):
                logger.warning(f"Sync already in progress for user {user_id}. Skipping.")
                if task_instance:
                    task_instance.update_state(state='SUCCESS', meta={'message': 'Skipped (Already Running)'})
                return

            # B. Check Recency (Did we just sync?)
            # B. Check Recency (Disabled for testing)
            # last_sync_ts = redis_client.get(last_sync_key)
            # if last_sync_ts:
            #     try:
            #         time_since = time.time() - float(last_sync_ts)
            #         if time_since < 20: # 20 seconds debounce
            #             logger.info(f"Sync too recent ({time_since:.0f}s ago). Skipping redundant auto-sync.")
            #             if task_instance:
            #                 task_instance.update_state(state='SUCCESS', meta={'message': 'Skipped (Too Recent)'})
            #             return
            #     except:
            #         pass
            
            # Acquire Lock (Expires in 50s to allow next 1m sync)
            redis_client.setex(lock_key, 50, "locked")

            # 3. Connect to Exchange
            non_zero_assets = {}
            successful_fetches = 0
            
            # 3. Use Adapter to Fetch Data
            from adapters.factory import AdapterFactory
            try:
                adapter = AdapterFactory.get_adapter(integration.provider_id)
                assets_data = await adapter.fetch_balances(creds, integration.settings)
                successful_fetches = 1 # Mark as success if no exception
            except Exception as e:
                logger.error(f"Adapter Sync Error: {e}")
                if task_instance:
                    task_instance.update_state(state='FAILURE', meta={'error': f"Sync Error: {str(e)}"})
                return

            # 4. Save to DB (Delete existing, then insert new)
            await db.execute(delete(UnifiedAsset).where(UnifiedAsset.integration_id == integration.id))
            
            if task_instance:
                 task_instance.update_state(state='PROGRESS', meta={'current': 85, 'total': 100, 'stage': 'PROCESSING', 'message': f'Processing {len(assets_data)} assets...'})
            
            new_assets = []
            total_portfolio_value = 0.0
            
            for ad in assets_data:
                # Get exchange rate to USD
                rate = await currency_service.get_rate(ad.currency, "USD")
                usd_value = float(ad.amount) * float(ad.price) * rate
                total_portfolio_value += usd_value

                asset = UnifiedAsset(
                    user_id=integration.user_id,
                    integration_id=integration.id,
                    symbol=ad.symbol,     
                    name=ad.name,              
                    original_name=ad.original_symbol or ad.symbol, 
                    asset_type=ad.asset_type,
                    amount=ad.amount,
                    currency=ad.currency,
                    current_price=ad.price, 
                    change_24h=ad.change_24h,
                    usd_value=usd_value,
                    image_url=ad.image_url
                )
                new_assets.append(asset)
            
            if new_assets:
                if task_instance:
                     task_instance.update_state(state='PROGRESS', meta={'current': 90, 'total': 100, 'stage': 'SAVING', 'message': 'Saving to database...'})
                db.add_all(new_assets)
                
            # 5. Create Portfolio Snapshot (Deduplicated)
            # Calculate Total Net Worth and Integration Completeness
            active_ints_result = await db.execute(
                select(func.count(Integration.id)).where(Integration.user_id == integration.user_id, Integration.is_active == True)
            )
            total_active_ints = active_ints_result.scalar() or 0
            
            assets_ints_result = await db.execute(
                select(func.count(func.distinct(UnifiedAsset.integration_id)))
                .where(UnifiedAsset.user_id == integration.user_id)
            )
            current_assets_ints = assets_ints_result.scalar() or 0

            current_net_worth_result = await db.execute(
                select(func.sum(UnifiedAsset.usd_value))
                .where(UnifiedAsset.user_id == integration.user_id)
            )
            current_net_worth = current_net_worth_result.scalar() or 0.0
            
            if current_net_worth >= 0:
                # Check for a very recent snapshot (last 45 seconds) to avoid spam from multiple integrations
                recent_cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=45)
                recent_snap_result = await db.execute(
                    select(PortfolioSnapshot)
                    .where(
                        PortfolioSnapshot.user_id == integration.user_id,
                        PortfolioSnapshot.timestamp >= recent_cutoff
                    )
                    .order_by(PortfolioSnapshot.timestamp.desc())
                    .limit(1)
                )
                existing_snapshot = recent_snap_result.scalar_one_or_none()
                
                is_partial = current_assets_ints < total_active_ints
                snapshot_data = {
                    "asset_count": len(new_assets), 
                    "source": "worker_sync", 
                    "integrations_count": current_assets_ints,
                    "total_integrations": total_active_ints,
                    "is_partial": is_partial
                }

                if existing_snapshot:
                    # Update existing instead of creating new
                    existing_snapshot.total_value_usd = float(current_net_worth)
                    existing_snapshot.timestamp = datetime.datetime.now(datetime.timezone.utc)
                    existing_snapshot.data = snapshot_data
                else:
                    # Create new
                    snapshot = PortfolioSnapshot(
                        user_id=integration.user_id,
                        total_value_usd=float(current_net_worth),
                        data=snapshot_data
                    )
                    db.add(snapshot)
            
            await db.commit()
            if task_instance:
                task_instance.update_state(state='PROGRESS', meta={'current': 100, 'total': 100, 'stage': 'DONE', 'message': 'Sync complete'})
            # Update Last Sync Time in Redis (for frontend & debounce)
            redis_client.set(f"sync_last_time:{integration.user_id}", str(time.time()))
            
            logger.info(f"Successfully synced {len(new_assets)} assets. Total Value: ${total_portfolio_value:,.2f}")


        finally:
             # Release Lock
             if 'integration' in locals() and integration:
                 redis_client.delete(f"sync_lock:{integration.user_id}")
             
             # Also update last sync time if successful? 
             # Only if we reached the end successfully.
             # Actually, we should set last_sync_key BEFORE finally if success, 
             # but here we just want to ensure lock release.
             
             await local_engine.dispose()

@celery_app.task(bind=True, name="sync_integration_data")
def sync_integration_data(self, integration_id: str):
    """
    Celery task wrapper for async sync logic
    """
    asyncio.run(sync_integration_data_async(integration_id, self))

@celery_app.task(name="trigger_global_sync")
def trigger_global_sync():
    """
    Scheduled task to trigger sync for ALL integrations.
    This fetches all integration IDs and dispatches individual update tasks.
    """
    logger.info("⏰ Global Sync: Starting scheduled update for all users...")
    
    # Minimal synchronous engine for this lightweight dispatcher
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    
    # Use sync engine just for ID lookup to avoid asyncio complexity in simple beat task
    # Or just use the async logic inside a wrapper. 
    # Let's use a quick synchronous check since we just need IDs.
    
    # Alternatively, use asyncio.run with the existing async engine? 
    # Let's stick to the pattern used in sync_integration_data wrapper.
    
    async def dispatch_all():
        local_engine = create_async_engine(DATABASE_URL, echo=False)
        async with local_engine.connect() as conn:
            # Select valid integrations (e.g., Binance only for now)
            # Select ALL active integrations
            result = await conn.execute(
                select(Integration.id).where(Integration.is_active == True)
            )
            ids = result.scalars().all()
            
            logger.info(f"⏰ Global Sync: Found {len(ids)} integrations to update.")
            
            for int_id in ids:
                # Dispatch regular sync task for each
                sync_integration_data.delay(str(int_id))
                
        await local_engine.dispose()
                
    asyncio.run(dispatch_all())
