
import asyncio
import json
import logging
from uuid import UUID
import ccxt
from sqlalchemy import select, delete

from worker.celery_app import celery_app
from core.database import DATABASE_URL
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from models.assets import UnifiedAsset, AssetType, PortfolioSnapshot
from models.integration import Integration, ProviderID
from models.user import User
from core.security.encryption import encryption_service
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

            if integration.provider_id != ProviderID.binance:
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

            # 3. Connect to Exchange (Sync CCXT)
            try:
                if task_instance:
                    task_instance.update_state(state='PROGRESS', meta={'current': 10, 'total': 100, 'stage': 'CONNECTING', 'message': 'Connecting to Binance...'})
                
                exchange = ccxt.binance({
                    'apiKey': api_key,
                    'secret': api_secret,
                    'enableRateLimit': True
                })
                # Fetch Balance
                if task_instance:
                    task_instance.update_state(state='PROGRESS', meta={'current': 15, 'total': 100, 'stage': 'FETCHING_BALANCES', 'message': 'Fetching balances...'})
                
                # Define wallet types to check
                # 'spot': Default (includes Flexible Savings as LD*)
                # 'future': USDT-M Futures
                # 'delivery': Coin-M Futures
                # 'margin': Cross Margin
                # 'funding': Funding Wallet
                wallet_types = ['spot', 'future', 'delivery', 'padding', 'margin', 'funding']
                if integration.provider_id == ProviderID.binance:
                     # Binance specific adjustments if needed, though ccxt unifies 'type'
                     pass

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
                                
                    except Exception as e:
                        # Some wallets might not be enabled or supported, just log warning and continue
                        # logger.warning(f"Could not fetch {w_type} balance: {e}") 
                        pass # Squelch noisy errors for unused wallets

                # Special handling for "Trading Bots" if they are in isolated margin or specific accounts?
                # Usually standard fetch catches them in 'used' balance of Spot/Futures.
                
                # Filter non-zero
                non_zero_assets = {k: v for k, v in final_balances.items() if v > 0}
                
                logger.info(f"Total merged distinct assets: {len(non_zero_assets)}")
                
                logger.info(f"Fetched {len(non_zero_assets)} non-zero assets for {integration.name}")

                # --- NEW: Fetch Prices ---
                # We fetch all tickers to find USD prices. 
                # Optimization: In production we might cache this or fetch specific symbols.
                if task_instance:
                    task_instance.update_state(state='PROGRESS', meta={'current': 70, 'total': 100, 'stage': 'FETCHING_PRICES', 'message': 'Fetching market prices...'})
                
                tickers = exchange.fetch_tickers()
                
            except Exception as e:
                logger.error(f"CCXT Error: {e}")
                if task_instance:
                    task_instance.update_state(state='FAILURE', meta={'error': f"Exchange Error: {str(e)}"})
                return

            # 4. Save to DB (Delete existing, then insert new)
            await db.execute(delete(UnifiedAsset).where(UnifiedAsset.integration_id == integration.id))
            
            if task_instance:
                 task_instance.update_state(state='PROGRESS', meta={'current': 85, 'total': 100, 'stage': 'PROCESSING', 'message': 'Processing assets...'})
            
            new_assets = []
            total_portfolio_value = 0.0

            for original_symbol, amount in non_zero_assets.items():
                price = 0.0
                
                # Normalize Symbol (Strip LD)
                normalized_symbol = original_symbol
                if normalized_symbol.startswith("LD"):
                    normalized_symbol = normalized_symbol[2:]

                # Get Full Name from CoinGecko Service
                asset_name = await coingecko_service.get_coin_name(normalized_symbol)

                # Price Lookup
                if normalized_symbol in ['USDT', 'USDC', 'BUSD', 'DAI', 'FDUSD']:
                     price = 1.0
                else:
                    # Try finding a USDT pair
                    pair = f"{normalized_symbol}/USDT"
                    if pair in tickers:
                        price = tickers[pair]['last']
                    else:
                        # Try BUSD or USDC as fallback
                        fallback_pairs = [f"{normalized_symbol}/BUSD", f"{normalized_symbol}/USDC"]
                        for fp in fallback_pairs:
                            if fp in tickers:
                                price = tickers[fp]['last']
                                break
                
                if price is None: 
                    price = 0.0

                usd_value = float(amount) * float(price)
                total_portfolio_value += usd_value

                asset = UnifiedAsset(
                    user_id=integration.user_id,
                    integration_id=integration.id,
                    symbol=normalized_symbol,     # Normalized: BTC
                    name=asset_name,              # Full Name: Bitcoin
                    original_name=original_symbol, # Original: LDBTC
                    asset_type=AssetType.CRYPTO,
                    amount=amount,
                    usd_value=usd_value
                )
                new_assets.append(asset)
            
            if new_assets:
                if task_instance:
                     task_instance.update_state(state='PROGRESS', meta={'current': 90, 'total': 100, 'stage': 'SAVING', 'message': 'Saving to database...'})
                db.add_all(new_assets)
                
            # 5. Create Portfolio Snapshot
            # Only create snapshot if we have value > 0 to avoid empty noise
            if total_portfolio_value >= 0:
                snapshot = PortfolioSnapshot(
                    user_id=integration.user_id,
                    total_value_usd=total_portfolio_value,
                    data={"asset_count": len(new_assets), "source": "worker_sync"}
                )
                db.add(snapshot)
            
            await db.commit()
            if task_instance:
                task_instance.update_state(state='PROGRESS', meta={'current': 100, 'total': 100, 'stage': 'DONE', 'message': 'Sync complete'})
            logger.info(f"Successfully synced {len(new_assets)} assets. Total Value: ${total_portfolio_value:,.2f}")

        except Exception as e:
            logger.error(f"Sync Task Failed: {e}")
            await db.rollback()
            if task_instance:
                 task_instance.update_state(state='FAILURE', meta={'error': str(e)})
            raise e
        finally:
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
            result = await conn.execute(
                select(Integration.id).where(Integration.provider_id == ProviderID.binance)
            )
            ids = result.scalars().all()
            
            logger.info(f"⏰ Global Sync: Found {len(ids)} integrations to update.")
            
            for int_id in ids:
                # Dispatch regular sync task for each
                sync_integration_data.delay(str(int_id))
                
        await local_engine.dispose()
                
    asyncio.run(dispatch_all())
