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
        final_balances = {}
        
        loop = asyncio.get_event_loop()
        
        for w_type in wallet_types:
            try:
                params = {'type': w_type} if w_type != 'spot' else {}
                balance_data = await loop.run_in_executor(None, lambda: exchange.fetch_balance(params))
                total_data = balance_data.get('total', {})
                
                for currency, amount in total_data.items():
                    if amount > 0:
                        final_balances[currency] = final_balances.get(currency, 0.0) + amount
            except Exception as e:
                logger.warning(f"Could not fetch Binance {w_type} balance: {e}")

        if not final_balances:
            return []

        # Fetch Tickers for pricing
        tickers = await loop.run_in_executor(None, exchange.fetch_tickers)
        
        assets = []
        for symbol, amount in final_balances.items():
            price = 0.0
            change_24h = 0.0
            
            # Normalized symbol (handle Binance prefixes like LD)
            norm_symbol = symbol[2:] if symbol.startswith("LD") else symbol
            
            # Pricing
            if norm_symbol in ['USDT', 'USDC', 'BUSD', 'DAI', 'FDUSD', 'USD']:
                price = 1.0
            else:
                pair = f"{norm_symbol}/USDT"
                if pair in tickers:
                    price = tickers[pair]['last']
                    change_24h = tickers[pair].get('percentage', 0.0)
                else:
                    # Try fallback pairs
                    for fb in [f"{norm_symbol}/BUSD", f"{norm_symbol}/USDC"]:
                        if fb in tickers:
                            price = tickers[fb]['last']
                            change_24h = tickers[fb].get('percentage', 0.0)
                            break
            
            assets.append(AssetData(
                symbol=norm_symbol,
                original_symbol=symbol,
                amount=amount,
                price=price,
                name=norm_symbol, # Fallback name
                asset_type=AssetType.CRYPTO,
                change_24h=change_24h,
                image_url=IconResolver.get_icon_url(norm_symbol, AssetType.CRYPTO, self.get_provider_id())
            ))
            
        return assets
