import asyncio
import json
import logging
import sys
import os

# Ensure backend root is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from uuid import UUID
import ccxt
from sqlalchemy import select, delete

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
from core.services.coingecko import coingecko_service
from core.services.coingecko import coingecko_service

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
            
            # Acquire Lock (Expires in 2 mins)
            redis_client.setex(lock_key, 120, "locked")

            # 3. Connect to Exchange
            non_zero_assets = {}
            successful_fetches = 0
            
            try:
                if integration.provider_id == ProviderID.trading212:
                    from services.trading212 import Trading212Client
                    api_secret = creds.get("api_secret")
                    is_demo = integration.settings.get("is_demo", False) if integration.settings else False
                    client = Trading212Client(api_key=api_key, api_secret=api_secret, is_demo=is_demo)
                    
                    if task_instance:
                        task_instance.update_state(state='PROGRESS', meta={'current': 20, 'total': 100, 'stage': 'FETCHING', 'message': 'Fetching Trading 212 Data...'})

                    # 1. Cash
                    cash_data = await client.get_account_cash()
                    # T212 returns { "free": 100.0, "total": 120.0, "currency": "USD" ... }
                    # We treat free cash as the "Cash" asset.
                    free_cash = float(cash_data.get("free", 0.0))
                    currency = cash_data.get("currency", "USD") # e.g. "USD", "EUR"
                    
                    # Convert non-USD cash? For now assume 1:1 if USD, or just store as is.
                    # Ideally we need a forex rate if currency != USD. 
                    # Simplicity: Check if currency is USD/USDT/USDC -> 1.0. Else try to find price.
                    # Since we don't have a forex service handy in this snippet, we'll store it as a crypto-like asset
                    # and try to find its price in the common loop if possible, or default to 1 for USD.
                    
                    non_zero_assets[currency] = free_cash

                    # 2. Positions
                    positions = await client.get_open_positions()
                    # List of dicts: { "ticker": "AAPL_US_EQ", "quantity": 1.5, "averagePrice": 150.0, "currentPrice": 155.0 ... }
                    
                    for pos in positions:
                        ticker = pos.get("ticker")
                        qty = float(pos.get("quantity", 0))
                        if qty > 0:
                            non_zero_assets[ticker] = qty
                            
                    logger.info(f"Fetched {len(positions)} positions and cash from Trading 212")
                    successful_fetches = 1
                    
                    # Store raw T212 data to help with pricing later (optimization)
                    # We can use a side-dict to pass T212 specific prices to the next loop
                    t212_prices = {p.get("ticker"): float(p.get("currentPrice", 0)) for p in positions}
                     
                     # Fetch Metadata for Names
                    try:
                        raw_inst = await client.get_instruments()
                        # Create Map: Ticker -> Metadata
                        t212_instruments = {i.get("ticker"): i for i in raw_inst}
                        logger.info(f"Fetched metadata for {len(t212_instruments)} instruments from T212")
                    except Exception as e:
                        logger.warning(f"Failed to fetch T212 instruments metadata: {e}")
                        t212_instruments = {}
                     
                else: # BINANCE (Existing Logic)
                    exchange = ccxt.binance({
                        'apiKey': api_key,
                        'secret': api_secret,
                        'enableRateLimit': True
                    })
                    # Fetch Balance
                    if task_instance:
                        task_instance.update_state(state='PROGRESS', meta={'current': 15, 'total': 100, 'stage': 'FETCHING_BALANCES', 'message': 'Fetching balances...'})
                    
                    # Define wallet types to check
                    wallet_types = ['spot', 'future', 'delivery', 'padding', 'margin', 'funding']

                    final_balances = {}
                    
                    for w_type in wallet_types:
                        if w_type == 'padding': continue # skip padding
                        
                        try:
                            params = {}
                            if w_type != 'spot':
                                params = {'type': w_type}
                            
                            # Fetch
                            if task_instance:
                                 # 20-60% range for 6 wallet types
                                 progress_pct = 20 + int((wallet_types.index(w_type) / len(wallet_types)) * 40)
                                 task_instance.update_state(state='PROGRESS', meta={'current': progress_pct, 'total': 100, 'stage': 'FETCHING_BALANCES', 'message': f'Fetching {w_type} balances...'})
                            
                            balance_data = exchange.fetch_balance(params)
                            total_data = balance_data.get('total', {})
                            
                            # Log non-zero for debugging
                            found_assets = {k: v for k, v in total_data.items() if v > 0}
                            if found_assets:
                                logger.info(f"Found {len(found_assets)} assets in {w_type} wallet for {integration.name}")
                            
                            # Merge
                            for currency, amount in total_data.items():
                                if amount > 0:
                                    current = final_balances.get(currency, 0.0)
                                    final_balances[currency] = current + amount
                            
                            successful_fetches += 1
                                    
                        except Exception as e:
                            # Just log warning and continue, but don't count as success
                            logger.warning(f"Could not fetch {w_type} balance: {e}") 
                            # pass # Squelch noisy errors for unused wallets

                    # Filter non-zero
                    for k, v in final_balances.items():
                         if v > 0:
                             non_zero_assets[k] = v
                    
                    # Fetch Tickers for Binance pricing
                    if task_instance:
                        task_instance.update_state(state='PROGRESS', meta={'current': 70, 'total': 100, 'stage': 'FETCHING_PRICES', 'message': 'Fetching market prices...'})
                    tickers = exchange.fetch_tickers()

            except Exception as e:
                logger.error(f"Exchange Sync Error: {e}")
                if task_instance:
                    task_instance.update_state(state='FAILURE', meta={'error': f"Exchange Error: {str(e)}"})
                return

            # 4. Save to DB (Delete existing, then insert new)
            await db.execute(delete(UnifiedAsset).where(UnifiedAsset.integration_id == integration.id))
            
            if task_instance:
                 task_instance.update_state(state='PROGRESS', meta={'current': 85, 'total': 100, 'stage': 'PROCESSING', 'message': 'Processing assets...'})
            
            new_assets = []
            total_portfolio_value = 0.0
            
            # Helper for T212 normalization
            from services.trading212 import Trading212Client as T212Helper 

            for original_symbol, amount in non_zero_assets.items():
                price = 0.0
                asset_type = AssetType.CRYPTO # Default
                
                # Normalize Symbol
                normalized_symbol = original_symbol
                
                if integration.provider_id == ProviderID.binance:
                    if normalized_symbol.startswith("LD"):
                        normalized_symbol = normalized_symbol[2:]
                elif integration.provider_id == ProviderID.trading212:
                     normalized_symbol = T212Helper.normalize_ticker(original_symbol)
                     asset_type = AssetType.STOCK # Assume standard T212 assets are stocks/ETFs
                     if normalized_symbol in ["USD", "EUR", "GBP", "USDT", "USDC"]:
                         asset_type = AssetType.FIAT # Or Crypto stablecoin

                # Legacy Market Data Service Removed per user request.
                # using only Authoritative Broker Data.

                asset_name = None
                logo_url_found = None # No logos allowed
                
                # NAME RESOLUTION:
                # 1. Trading 212 Metadata (Authoritative)
                # 2. Normalized Symbol (Fallback)
                
                if integration.provider_id == ProviderID.trading212 and 't212_instruments' in locals():
                     # Match by Original Symbol
                     inst = t212_instruments.get(original_symbol)
                     if inst:
                         asset_name = inst.get("name") or inst.get("shortName")
                
                if not asset_name:
                     asset_name = normalized_symbol

                # PRICE LOGIC:
                # 1. T212 Direct
                # 2. Hardcoded Stablecoins
                # 3. Binance Tickers
                
                if integration.provider_id == ProviderID.trading212 and 't212_prices' in locals() and original_symbol in t212_prices:
                     # Use Direct T212 Price
                     price = t212_prices[original_symbol]
                
                elif normalized_symbol in ['USDT', 'USDC', 'BUSD', 'DAI', 'FDUSD', 'USD']:
                     price = 1.0
                     
                elif integration.provider_id == ProviderID.binance and 'tickers' in locals():
                    # Existing Binance Ticker Logic
                    pair = f"{normalized_symbol}/USDT"
                    if pair in tickers:
                        price = tickers[pair]['last']
                        change_24h = tickers[pair].get('percentage', 0.0)
                    else:
                         fallback_pairs = [f"{normalized_symbol}/BUSD", f"{normalized_symbol}/USDC"]
                         for fp in fallback_pairs:
                             if fp in tickers:
                                 price = tickers[fp]['last']
                                 change_24h = tickers[fp].get('percentage', 0.0)
                                 break
                
                if price is None:
                    price = 0.0
                    
                current_price = price
                usd_value = float(amount) * float(price)
                total_portfolio_value += usd_value

                asset = UnifiedAsset(
                    user_id=integration.user_id,
                    integration_id=integration.id,
                    symbol=normalized_symbol,     
                    name=asset_name,              
                    original_name=original_symbol, 
                    asset_type=asset_type,
                    amount=amount,
                    current_price=current_price, 
                    change_24h=change_24h,
                    usd_value=usd_value,
                    image_url=logo_url_found
                    # TODO: Add logo_url to UnifiedAsset model if it exists? 
                    # Currently model might not support it. 
                    # If model changes needed, I should update implementation plan.
                    # For now, we fix the NAME issue. 
                )
                new_assets.append(asset)
            
            if new_assets:
                if task_instance:
                     task_instance.update_state(state='PROGRESS', meta={'current': 90, 'total': 100, 'stage': 'SAVING', 'message': 'Saving to database...'})
                db.add_all(new_assets)
                
            # 5. Create Portfolio Snapshot
            # Calculate Total Net Worth from DB to ensure it includes ALL integrations (even if stale)
            current_net_worth_result = await db.execute(
                select(func.sum(UnifiedAsset.usd_value))
                .where(UnifiedAsset.user_id == integration.user_id)
            )
            current_net_worth = current_net_worth_result.scalar() or 0.0
            
            # Use a threshold (e.g. > 0) to save snapshot
            if current_net_worth >= 0:
                snapshot = PortfolioSnapshot(
                    user_id=integration.user_id,
                    total_value_usd=float(current_net_worth),
                    data={"asset_count": len(new_assets), "source": "worker_sync", "partial_update": True}
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
