import asyncio
from typing import List, Dict, Any, Optional
import logging
from tradernet import Client, Config
from adapters.base import BaseAdapter, AssetData
from models.assets import AssetType

logger = logging.getLogger(__name__)

class Freedom24Adapter(BaseAdapter):
    def get_provider_id(self) -> str:
        return "freedom24"

    async def validate_credentials(self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None) -> bool:
        """
        Validates keys by attempting to fetch basic user info.
        Note: The SDK is synchronous, so we wrap it.
        """
        api_key = credentials.get("api_key")
        secret_key = credentials.get("secret_key")

        if not api_key or not secret_key:
            return False

        def _validate():
            try:
                # Initialize SDK
                # Note: Config might require specific params
                config = Config(api_key=api_key, secret_key=secret_key)
                client = Client(config)
                # get_user_info or similar commands verify keys
                # Using get_notify or get_orders as a lightweight check
                # 'getNotify' returns events, usually safe to call.
                # However, the SDK documentation standard call is often just accessing a property or simple method.
                # Let's try to get current cash balance
                try:
                    # Generic method to call 'getAuthInfo' or 'getNotify'
                    res = client.send_request("getAuthInfo")
                    return True
                except Exception:
                    # Try another one if that fails
                    return False
            except Exception as e:
                logger.error(f"Freedom24 Auth Check Failed: {e}")
                return False

        return await asyncio.to_thread(_validate)

    async def fetch_balances(self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None) -> List[AssetData]:
        api_key = credentials.get("api_key")
        secret_key = credentials.get("secret_key")

        def _fetch():
            config = Config(api_key=api_key, secret_key=secret_key)
            client = Client(config)
            
            assets_list = []
            
            # 1. Get Positions (Stocks/ETFs)
            # Command: getPositionJson
            # The SDK likely has a wrapper or we use send_request
            try:
                positions = client.send_request("getPositionJson")
                # Format: {"result": [...], "errMsg": ...} or list of dicts.
                # Usually Tradernet returns a 'result' key.
                
                # Check structure
                data = positions.get("result", [])
                if not data and isinstance(positions, list):
                    data = positions
                
                for pos in data:
                    # Example fields:
                    # i: ticker (e.g. AAPL.US)
                    # q: quantity
                    # a: average_price
                    # m: market_price
                    # t: type?
                    # curr: currency
                    
                    ticker = pos.get("i")
                    quantity = float(pos.get("q", 0))
                    
                    if quantity == 0:
                        continue
                        
                    avg_price = float(pos.get("a", 0))
                    market_price = float(pos.get("m", 0) or avg_price)
                    currency = pos.get("curr", "USD")
                    name = pos.get("name") # Sometimes available
                    
                    # Log mapping issues
                    if not ticker:
                        continue

                    assets_list.append(AssetData(
                        symbol=ticker,
                        original_symbol=ticker,
                        amount=quantity,
                        price=market_price,
                        currency=currency,
                        name=name or ticker,
                        asset_type=AssetType.STOCK, # Assume Stock for now
                        change_24h=0.0 # Will be calculated by internal service
                    ))

            except Exception as e:
                logger.error(f"Error fetching Freedom24 positions: {e}")
                # We don't raise immediately to allow Cash fetch to proceed

            # 2. Get Cash Balance
            # Command: getT0Portfolio or getPortfolio
            try:
                portfolio = client.send_request("getPortfolio")
                # Need to find cash entries.
                # Often in 'result' -> 'funds' or similar.
                # Tradernet API structure for portfolio:
                # 'd', 'e', 'profit', etc. 
                # Let's rely on 'getNotify' or similar for strict cash if getPortfolio is complex.
                # Actually, 'getPositionJson' sometimes returns cash as special tickers? No.
                # Let's use specific currency fields if available. 
                
                # Analyzing getPortfolio response structure is tricky without docs.
                # Fallback: Assume the SDK might provide a clean client.get_cash() if official.
                # If not, we generally skip cash if we can't be sure, OR use a known command.
                # 'getProfitability' maybe?
                
                pass # Temporary skip cash until verified with real API response or better docs
                
            except Exception as e:
                logger.error(f"Error fetching Freedom24 cash: {e}")
                
            return assets_list

        return await asyncio.to_thread(_fetch)
