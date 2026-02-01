from typing import List, Dict, Any, Optional
from adapters.base import BaseAdapter, AssetData
from services.trading212 import Trading212Client
from services.icons import IconResolver
from models.assets import AssetType
import logging

logger = logging.getLogger(__name__)

# Trading 212 Adapter

class Trading212Adapter(BaseAdapter):
    def get_provider_id(self) -> str:
        return "trading212"

    async def validate_credentials(self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None) -> bool:
        api_key = credentials.get("api_key")
        api_secret = credentials.get("api_secret")
        is_demo = settings.get("is_demo", False) if settings else False
        
        client = Trading212Client(api_key=api_key, api_secret=api_secret, is_demo=is_demo)
        result = await client.validate_keys()
        return result.get("valid", False)

    async def fetch_balances(self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None) -> List[AssetData]:
        api_key = credentials.get("api_key")
        api_secret = credentials.get("api_secret")
        is_demo = settings.get("is_demo", False) if settings else False
        
        client = Trading212Client(api_key=api_key, api_secret=api_secret, is_demo=is_demo)
        
        # 1. Get Account Info (Currency)
        # We must NOT catch exceptions here. If metadata fails (e.g. 429 Rate Limit), 
        # we should fail the entire sync rather than fallback to "USD" and corrupt the user's data.
        account_meta = await client.get_account_metadata()
        account_currency = account_meta.get("currencyCode", "USD")

        # 2. Cash
        cash_data = await client.get_account_cash()
        free_cash = float(cash_data.get("free", 0.0))
        # Cash is always displayed in account currency
        
        assets = []
        if free_cash > 0:
            assets.append(AssetData(
                symbol=account_currency, # e.g. EUR
                original_symbol=account_currency,
                amount=free_cash,
                price=1.0, # Price of 1 unit of currency in itself is 1. We rely on FX service for conversion later.
                name=account_currency,
                currency=account_currency,
                asset_type=AssetType.FIAT,
                image_url=IconResolver.get_icon_url(account_currency, AssetType.FIAT, self.get_provider_id())
            ))

        # 2. Positions
        positions = await client.get_open_positions()
        instruments_raw = await client.get_instruments()
        instruments = {i.get("ticker"): i for i in instruments_raw}
        
        for pos in positions:
            ticker = pos.get("ticker")
            qty = float(pos.get("quantity", 0))
            if qty <= 0:
                continue
                
            price = float(pos.get("currentPrice", 0))
            normalized_symbol = Trading212Client.normalize_ticker(ticker)
            
            # Name and Currency from metadata
            # Trading 212 tickers in positions sometimes differ from metadata (suffixes)
            inst = instruments.get(ticker)
            if not inst:
                # Try common suffixes or partial match
                clean_ticker = ticker.split('_')[0]
                # Look for first match that starts with clean_ticker
                for k, v in instruments.items():
                    if k.startswith(clean_ticker):
                        inst = v
                        break
            
            if not inst:
                logger.warning(f"Metadata not found for ticker {ticker}")
            else:
                logger.debug(f"Metadata for {ticker} matched to {inst.get('ticker')}: {inst.get('name')}")
                
            name = inst.get("name") or inst.get("shortName") if inst else normalized_symbol
            asset_currency = inst.get("currencyCode", "USD") if inst else "USD"
            
            assets.append(AssetData(
                symbol=normalized_symbol,
                original_symbol=ticker,
                amount=qty,
                price=price,
                name=name,
                currency=asset_currency,
                asset_type=AssetType.STOCK,
                image_url=IconResolver.get_icon_url(normalized_symbol, AssetType.STOCK, self.get_provider_id(), ticker, name)
            ))
            
        return assets
