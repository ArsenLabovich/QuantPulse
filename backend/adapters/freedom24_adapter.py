import asyncio
import json
import hmac
import hashlib
import httpx
from typing import List, Dict, Any, Optional
import logging
from tradernet import TraderNetAPI
from adapters.base import BaseAdapter, AssetData
from models.assets import AssetType

logger = logging.getLogger(__name__)

class Freedom24Adapter(BaseAdapter):
    """
    Adapter for Freedom24 (Tradernet) API.
    Uses API V2 with header-based signing for compatibility with European accounts.
    """
    def get_provider_id(self) -> str:
        return "freedom24"

    async def _make_request(self, credentials: Dict[str, Any], cmd: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        api_key = credentials.get("api_key")
        api_secret = credentials.get("api_secret")
        
        # Use tradernet.com for both RU and EU accounts
        url = f"https://tradernet.com/api/v2/cmd/{cmd}"
        
        body_dict = {"apiKey": api_key}
        if params:
            body_dict.update(params)
            
        # Standard V2 signing: alphabetical sort of parameters in the body string
        sorted_keys = sorted(body_dict.keys())
        body_str = "&".join(f"{k}={body_dict[k]}" for k in sorted_keys)
        
        sig = hmac.new(
            api_secret.encode('utf-8'),
            body_str.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        headers = {
            "X-NtApi-PublicKey": api_key,
            "X-NtApi-Sig": sig,
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, data=body_dict, headers=headers, timeout=30.0)
                logger.info(f"Freedom24 Request [{cmd}] Status: {response.status_code}")
                
                if response.status_code != 200:
                    logger.error(f"Freedom24 API Error {response.status_code}: {response.text}")
                    return {"error": "HTTP Error", "errMsg": response.text}
                    
                return response.json()
            except Exception as e:
                logger.error(f"Freedom24 Request Failed: {e}")
                return {"error": "Request Failed", "errMsg": str(e)}

    async def validate_credentials(self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None) -> bool:
        """
        Validates keys by attempting to fetch basic user info using getSidInfo.
        """
        api_key = credentials.get("api_key")
        api_secret = credentials.get("api_secret")

        if not api_key or not api_secret:
            return False

        try:
            res = await self._make_request(credentials, 'getSidInfo')
            logger.info(f"Freedom24 Auth Verification: {res}")
            
            # code 0 or absence of error code usually means success
            if not res or (isinstance(res, dict) and res.get('error') and res.get('code') != 0):
                logger.error(f"Freedom24 Auth Check failed: {res.get('errMsg', 'Unknown error')}")
                return False
            return True
        except Exception as e:
            logger.error(f"Freedom24 Auth Check Failed: {e}")
            return False

    async def fetch_balances(self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None) -> List[AssetData]:
        """
        Fetches positions and cash from getPositionJson.
        """
        # We wrap the async call in asyncio.run inside a thread if called from sync context
        # but here we are in an async method.
        return await self._do_fetch(credentials)

    async def _do_fetch(self, credentials: Dict[str, Any]) -> List[AssetData]:
        assets_list = []
        
        try:
            # getPositionJson provides both positions (pos) and cash accounts (acc)
            res = await self._make_request(credentials, "getPositionJson")
            
            if not res or not isinstance(res, dict):
                logger.error("Freedom24 fetch_balances: Invalid response format")
                return []
                
            if res.get("error") and res.get("code") != 0:
                logger.error(f"Freedom24 getPositionJson Error: {res.get('errMsg')}")
                return []
            
            # Access deep structure: result -> ps -> (pos, acc)
            ps_data = res.get("result", {}).get("ps", {})
            
            # 1. Parse Positions (Stocks/ETFs)
            positions = ps_data.get("pos", [])
            for pos in positions:
                ticker = pos.get("i")
                quantity = float(pos.get("q", 0))
                
                if quantity == 0:
                    continue
                    
                market_price = float(pos.get("mkt_price", 0))
                currency = pos.get("curr", "USD")
                name = pos.get("name")
                
                if not ticker:
                    continue

                assets_list.append(AssetData(
                    symbol=ticker,
                    original_symbol=ticker,
                    amount=quantity,
                    price=market_price,
                    currency=currency,
                    name=name or ticker,
                    asset_type=AssetType.STOCK,
                    change_24h=0.0
                ))

            # 2. Parse Cash Accounts
            accounts = ps_data.get("acc", [])
            for acc in accounts:
                currency = acc.get("curr")
                # field 's' is the settled balance
                amount = float(acc.get("s", 0))
                
                if amount > 0 and currency:
                    assets_list.append(AssetData(
                        symbol=currency,
                        original_symbol=currency,
                        amount=amount,
                        price=1.0,
                        currency=currency,
                        name=f"Cash ({currency})",
                        asset_type=AssetType.FIAT,
                        change_24h=0.0
                    ))
            
            logger.info(f"Freedom24 successfully fetched {len(assets_list)} assets")
                
        except Exception as e:
            logger.error(f"Error in Freedom24 _do_fetch: {e}")
            import traceback
            logger.error(traceback.format_exc())
            
        return assets_list
