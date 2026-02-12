"""
Binance Adapter — Integration with Binance Exchange via CCXT.

This adapter handles complex balance aggregation across different Binance sub-accounts:
- Spot, Margin, Future, Funding.
- Simple Earn (Flexible & Locked).
- Staking & DeFi Staking.
- BNB Vault.

It includes sophisticated deduplication logic because Binance often reports the same 
assets across multiple API endpoints (e.g., Simple Earn assets showing up in both 
the Spot 'LD' view and the specialized Simple Earn endpoint).
"""
from typing import List, Dict, Any, Optional
import ccxt
import asyncio
import logging
from adapters.base import BaseAdapter, AssetData
from services.icons import IconResolver
from models.assets import AssetType

logger = logging.getLogger(__name__)

# Registration of icon strategy for Binance assets
IconResolver.register_strategy(
    "binance",
    lambda symbol, asset_type, original_ticker:
        f"https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/{symbol.lower()}.png"
        if asset_type == AssetType.CRYPTO else None
)

class BinanceAdapter(BaseAdapter):
    """
    Adapter for Binance Exchange. 
    Uses CCXT to fetch data and implements custom deduplication for sub-accounts.
    """
    def get_provider_id(self) -> str:
        return "binance"
# ... (validate_credentials remains same)
    async def validate_credentials(self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None) -> bool:
        """
        Validates API Key and Secret by attempting a lightweight fetch_balance call.
        """
        api_key = credentials.get("api_key")
        api_secret = credentials.get("api_secret")
        
        try:
            exchange = ccxt.binance({
                'apiKey': api_key,
                'secret': api_secret,
                'enableRateLimit': True
            })
            # ccxt.binance uses blocking calls by default; we wrap them in an executor
            # to keep the event loop responsive.
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, exchange.fetch_balance)
            return True
        except Exception as e:
            logger.error(f"Binance validation failed: {e}")
            return False

    async def fetch_balances(self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None) -> List[AssetData]:
        """
        Fetches balances from all available Binance sub-accounts and provides 
        a deduplicated unified view.
        """
        api_key = credentials.get("api_key")
        api_secret = credentials.get("api_secret")
        
        exchange = ccxt.binance({
            'apiKey': api_key,
            'secret': api_secret,
            'enableRateLimit': True
        })
        
        wallet_types = ['spot', 'future', 'delivery', 'funding']
        loop = asyncio.get_event_loop()
        
        # detailed_balances: symbol -> {source: amount}
        # This structure allows us to see exactly where Binance reports each asset.
        detailed_balances = {} 
        skipped_sources = []  
        
        def add_balance(symbol, source, amount):
            if abs(amount) < 1e-12: return
            if symbol not in detailed_balances: detailed_balances[symbol] = {}
            detailed_balances[symbol][source] = detailed_balances[symbol].get(source, 0.0) + amount

        # Phase 1: Standard Wallets (Spot, Future, Delivery, Funding)
        for w_type in wallet_types:
            try:
                params = {'type': w_type} if w_type != 'spot' else {}
                balance_data = await loop.run_in_executor(None, lambda: exchange.fetch_balance(params))
                total_data = balance_data.get('total', {})
                for symbol, amount in total_data.items():
                    # 'LD' prefix handles assets visible in Spot view that actually belong to Flexible Earn
                    norm_symbol = symbol[2:] if symbol.startswith("LD") else symbol
                    add_balance(norm_symbol, f"{w_type}-{symbol}", amount)
            except Exception as e:
                logger.warning(f"Could not fetch Binance {w_type} balance: {e}")

        # 2. Simple Earn (Flexible)
        try:
            flex_earn = await loop.run_in_executor(None, lambda: exchange.sapi_get_simple_earn_flexible_position({'size': 100}))
            for row in flex_earn.get('rows', []):
                symbol = row['asset']
                amount = float(row.get('totalAmount') or 0)
                norm_symbol = symbol[2:] if symbol.startswith("LD") else symbol
                add_balance(norm_symbol, "SimpleEarn-Flexible", amount)
        except Exception as e:
            logger.warning(f"Could not fetch Simple Earn Flexible: {e}")
            skipped_sources.append("SimpleEarn-Flexible")

        # 3. Simple Earn (Locked)
        try:
            locked_earn = await loop.run_in_executor(None, lambda: exchange.sapi_get_simple_earn_locked_position({'size': 100}))
            for row in locked_earn.get('rows', []):
                symbol = row['asset']
                amount = float(row.get('amount') or row.get('totalAmount') or 0)
                norm_symbol = symbol[2:] if symbol.startswith("LD") else symbol
                add_balance(norm_symbol, "SimpleEarn-Locked", amount)
        except Exception as e:
            logger.warning(f"Could not fetch Simple Earn Locked: {e}")
            skipped_sources.append("SimpleEarn-Locked")

        # 4. Staking / DeFi / Savings (Exhaustive search)
        for p_type in ['STAKING', 'L_DEFI', 'F_DEFI']:
            try:
                staking_pos = await loop.run_in_executor(None, lambda: exchange.sapi_get_staking_position({'product': p_type, 'size': 100}))
                for row in staking_pos:
                    symbol = row['asset']
                    amount = float(row.get('amount') or 0)
                    norm_symbol = symbol[2:] if symbol.startswith("LD") else symbol
                    add_balance(norm_symbol, f"Staking-{p_type}", amount)
            except Exception as e:
                logger.debug(f"Could not fetch Staking ({p_type}): {e}")
                skipped_sources.append(f"Staking-{p_type}")

        # 5. BNB Vault & Margin
        try:
            vault = await loop.run_in_executor(None, exchange.sapi_get_bnb_vault_account)
            amount = float(vault.get('totalAmount') or 0)
            add_balance('BNB', "BNB-Vault", amount)
        except Exception as e:
            logger.debug(f"Could not fetch BNB Vault: {e}")
            skipped_sources.append("BNB-Vault")

        try:
            margin = await loop.run_in_executor(None, exchange.sapi_get_margin_account)
            for asset_info in margin.get('userAssets', []):
                asset = asset_info['asset']
                net_amount = float(asset_info['netAsset'])
                add_balance(asset, "Cross-Margin", net_amount)
        except Exception as e:
            logger.warning(f"Could not fetch Margin account: {e}")
            skipped_sources.append("Cross-Margin")

        # 6. Direct Funding Assets
        try:
            funding = await loop.run_in_executor(None, exchange.sapi_post_asset_get_funding_asset)
            for item in funding:
                asset = item['asset']
                amount = float(item['free']) + float(item['freeze']) + float(item['withdrawing'])
                add_balance(asset, "Funding-Direct", amount)
        except Exception as e:
            logger.warning(f"Could not fetch Funding assets: {e}")
            skipped_sources.append("Funding-Direct")

        # Phase 6: Deduplication logic
        # Binance often reports the same value in different ways (e.g., Simple Earn assets 
        # showing up as 'LD-prefixed' in Spot and also in dedicated Simple Earn reports).
        # We group sources into 'buckets' and take the maximum value from each bucket
        # to ensure we don't double-count.
        final_balances = {}
        for symbol, sources in detailed_balances.items():
            logger.info(f"Binance Detail for {symbol}: {sources}")
            
            # Bucket 1: Flexible Positions
            flex_vals = [v for k, v in sources.items() if "simpleearn-flexible" in k.lower() or "-ld" in k.lower()]
            flex_total = max(flex_vals) if flex_vals else 0.0
            
            # Bucket 2: Locked Positions, Staking, and Vault
            locked_vals = [v for k, v in sources.items() if any(x in k.lower() for x in ["simpleearn-locked", "staking-", "bnb-vault"])]
            locked_total = max(locked_vals) if locked_vals else 0.0
            
            # Bucket 3: Funding Wallet
            funding_vals = [v for k, v in sources.items() if any(x in k.lower() for x in ["funding-", "funding_asset"])]
            funding_total = max(funding_vals) if funding_vals else 0.0
            
            # Bucket 4: Pure Liquid Balances (Additive)
            liquid_total = 0.0
            for k, v in sources.items():
                k_lower = k.lower()
                if any(x in k_lower for x in ["simpleearn-", "staking-", "funding-", "-ld", "bnb-vault", "funding_asset"]):
                    continue
                liquid_total += v
            
            total = flex_total + locked_total + funding_total + liquid_total
            
            if total > 1e-8:
                final_balances[symbol] = total

        logger.info(f"Binance FINAL combined balances: {final_balances}")
        if skipped_sources:
            logger.warning(f"Binance sync completed with {len(skipped_sources)} skipped sources: {skipped_sources}")

        # Fetch Tickers
        tickers = await loop.run_in_executor(None, exchange.fetch_tickers)
        
        assets = []
        for symbol, amount in final_balances.items():
            price = 0.0
            change_24h = 0.0
            if symbol in ['USDT', 'USDC', 'BUSD', 'DAI', 'FDUSD', 'USD', 'USDS', 'USDP', 'BNFCR']:
                price = 1.0
            else:
                for quote in ['USDT', 'USDC', 'BUSD', 'FDUSD', 'EUR', 'USD']:
                    pair = f"{symbol}/{quote}"
                    if pair in tickers:
                        price = tickers[pair]['last']
                        change_24h = tickers[pair].get('percentage', 0.0)
                        # If the quote is EUR, convert back to USD? 
                        # Actually, tickers are usually in the quote currency.
                        # But Binance crypto pairs are mostly against stables.
                        break
            
            assets.append(AssetData(
                symbol=symbol, amount=amount, price=price, name=symbol,
                asset_type=AssetType.CRYPTO, change_24h=change_24h,
                image_url=IconResolver.get_icon_url(symbol, AssetType.CRYPTO, self.get_provider_id())
            ))
        return assets
