from typing import List, Dict, Any, Optional
import ccxt
import asyncio
from adapters.base import BaseAdapter, AssetData
from services.icons import IconResolver
from models.assets import AssetType
import logging

logger = logging.getLogger(__name__)

# Register Binance Icon Strategy (Handled by global crypto fallback mostly)
IconResolver.register_strategy(
    "binance",
    lambda symbol, asset_type, original_ticker:
        f"https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/{symbol.lower()}.png"
        if asset_type == AssetType.CRYPTO else None
)

class BinanceAdapter(BaseAdapter):
    def get_provider_id(self) -> str:
        return "binance"
# ... (validate_credentials remains same)
    async def validate_credentials(self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None) -> bool:
        api_key = credentials.get("api_key")
        api_secret = credentials.get("api_secret")
        
        try:
            exchange = ccxt.binance({
                'apiKey': api_key,
                'secret': api_secret,
                'enableRateLimit': True
            })
            # Lightweight check
            # fetch_balance is an async method in ccxt.async_support, 
            # but wait, BinanceAdapter is NOT using async_support yet?
            # It uses loop.run_in_executor. I'll stick to that for now to avoid breaking things.
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, exchange.fetch_balance)
            return True
        except Exception as e:
            logger.error(f"Binance validation failed: {e}")
            return False

    async def fetch_balances(self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None) -> List[AssetData]:
        api_key = credentials.get("api_key")
        api_secret = credentials.get("api_secret")
        
        exchange = ccxt.binance({
            'apiKey': api_key,
            'secret': api_secret,
            'enableRateLimit': True
        })
        
        wallet_types = ['spot', 'future', 'delivery', 'funding']
        
        loop = asyncio.get_event_loop()
        
        # 1. Standard Wallets (Spot, Future, Delivery, Funding)
        detailed_balances = {} # symbol -> {source: amount}
        
        def add_bal(symbol, source, amount):
            if abs(amount) < 1e-12: return
            if symbol not in detailed_balances: detailed_balances[symbol] = {}
            detailed_balances[symbol][source] = detailed_balances[symbol].get(source, 0.0) + amount

        for w_type in wallet_types:
            try:
                params = {'type': w_type} if w_type != 'spot' else {}
                balance_data = await loop.run_in_executor(None, lambda: exchange.fetch_balance(params))
                total_data = balance_data.get('total', {})
                for symbol, amount in total_data.items():
                    # Handle LD prefix (Spot View of Flexible Earn)
                    norm_symbol = symbol[2:] if symbol.startswith("LD") else symbol
                    add_bal(norm_symbol, f"{w_type}-{symbol}", amount)
            except Exception as e:
                logger.warning(f"Could not fetch Binance {w_type} balance: {e}")

        # 2. Simple Earn (Flexible)
        try:
            flex_earn = await loop.run_in_executor(None, lambda: exchange.sapi_get_simple_earn_flexible_position({'size': 100}))
            for row in flex_earn.get('rows', []):
                symbol = row['asset']
                amount = float(row.get('totalAmount') or 0)
                norm_symbol = symbol[2:] if symbol.startswith("LD") else symbol
                add_bal(norm_symbol, "SimpleEarn-Flexible", amount)
        except Exception: pass

        # 3. Simple Earn (Locked)
        try:
            locked_earn = await loop.run_in_executor(None, lambda: exchange.sapi_get_simple_earn_locked_position({'size': 100}))
            for row in locked_earn.get('rows', []):
                symbol = row['asset']
                amount = float(row.get('amount') or row.get('totalAmount') or 0)
                norm_symbol = symbol[2:] if symbol.startswith("LD") else symbol
                add_bal(norm_symbol, "SimpleEarn-Locked", amount)
        except Exception: pass

        # 4. Staking / DeFi / Savings (Exhaustive search)
        for p_type in ['STAKING', 'L_DEFI', 'F_DEFI']:
            try:
                staking_pos = await loop.run_in_executor(None, lambda: exchange.sapi_get_staking_position({'product': p_type, 'size': 100}))
                for row in staking_pos:
                    symbol = row['asset']
                    amount = float(row.get('amount') or 0)
                    norm_symbol = symbol[2:] if symbol.startswith("LD") else symbol
                    add_bal(norm_symbol, f"Staking-{p_type}", amount)
            except Exception: pass

        # 5. BNB Vault & Margin
        try:
            vault = await loop.run_in_executor(None, exchange.sapi_get_bnb_vault_account)
            amount = float(vault.get('totalAmount') or 0)
            add_bal('BNB', "BNB-Vault", amount)
        except Exception: pass

        try:
            margin = await loop.run_in_executor(None, exchange.sapi_get_margin_account)
            for asset_info in margin.get('userAssets', []):
                asset = asset_info['asset']
                net_amount = float(asset_info['netAsset'])
                add_bal(asset, "Cross-Margin", net_amount)
        except Exception: pass

        # 6. Direct Funding Assets
        try:
            funding = await loop.run_in_executor(None, exchange.sapi_post_asset_get_funding_asset)
            for item in funding:
                asset = item['asset']
                amount = float(item['free']) + float(item['freeze']) + float(item['withdrawing'])
                add_bal(asset, "Funding-Direct", amount)
        except Exception: pass

        # --- DEDUPLICATION LOGIC ---
        final_balances = {}
        for symbol, sources in detailed_balances.items():
            logger.info(f"Binance Detail for {symbol}: {sources}")
            
            # Bucket 1: Flexible Positions (SimpleEarn-Flexible or LD-prefixed view assets)
            flex_vals = [v for k, v in sources.items() if "simpleearn-flexible" in k.lower() or "-ld" in k.lower()]
            flex_total = max(flex_vals) if flex_vals else 0.0
            
            # Bucket 2: Locked Positions & Staking & Vault
            # BNB Vault often overlaps with SimpleEarn-Locked or Staking reports.
            locked_vals = [v for k, v in sources.items() if any(x in k.lower() for x in ["simpleearn-locked", "staking-", "bnb-vault"])]
            locked_total = max(locked_vals) if locked_vals else 0.0
            
            # Bucket 3: Funding Wallet (Direct API vs fetch_balance report)
            funding_vals = [v for k, v in sources.items() if any(x in k.lower() for x in ["funding-", "funding_asset"])]
            funding_total = max(funding_vals) if funding_vals else 0.0
            
            # Bucket 4: Real liquid balances and unique buckets (additive)
            liquid_total = 0.0
            for k, v in sources.items():
                k_lower = k.lower()
                # Skip things already grouped above
                if any(x in k_lower for x in ["simpleearn-", "staking-", "funding-", "-ld", "bnb-vault", "funding_asset"]):
                    continue
                # This includes Spot (non-LD), Future, Delivery, Margin
                liquid_total += v
            
            total = flex_total + locked_total + funding_total + liquid_total
            
            if abs(total) > 0.00000001:
                final_balances[symbol] = total

        logger.info(f"Binance FINAL combined balances: {final_balances}")

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
