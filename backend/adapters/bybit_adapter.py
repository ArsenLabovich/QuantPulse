"""Bybit Exchange Adapter — Implementation for Bybit API integration."""

from typing import List, Dict, Any, Optional
import ccxt
import asyncio
from adapters.base import BaseAdapter, AssetData
from services.icons import IconResolver
from models.assets import AssetType
import logging

logger = logging.getLogger(__name__)


class BybitAdapter(BaseAdapter):
    def get_provider_id(self) -> str:
        return "bybit"

    async def validate_credentials(
        self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None
    ) -> bool:
        api_key = credentials.get("api_key")
        api_secret = credentials.get("api_secret")

        try:
            exchange = ccxt.bybit({"apiKey": api_key, "secret": api_secret, "enableRateLimit": True})

            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, exchange.fetch_balance)
            return True
        except Exception as e:
            logger.error(f"Bybit validation failed: {e}")
            return False

    async def fetch_balances(
        self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None
    ) -> List[AssetData]:
        api_key = credentials.get("api_key")
        api_secret = credentials.get("api_secret")

        exchange = ccxt.bybit({"apiKey": api_key, "secret": api_secret, "enableRateLimit": True})

        # Bybit Unified Account supports 'unified' type, but standard fetch_balance
        # usually auto-detects or returns what's available.
        # Classic accounts have 'spot', 'contract', etc.
        # We will try to fetch default balance which usually covers the main account type.

        final_balances = {}
        loop = asyncio.get_event_loop()

        try:
            # Fetch generic balance
            balance_data = await loop.run_in_executor(None, exchange.fetch_balance)
            total_data = balance_data.get("total", {})

            for currency, amount in total_data.items():
                if amount > 0:
                    final_balances[currency] = final_balances.get(currency, 0.0) + amount

        except Exception as e:
            logger.error(f"Could not fetch Bybit balance: {e}")
            return []

        if not final_balances:
            return []

        # Fetch Tickers for pricing
        try:
            tickers = await loop.run_in_executor(None, exchange.fetch_tickers)
        except Exception as e:
            logger.error(f"Could not fetch Bybit tickers: {e}")
            tickers = {}

        assets = []
        for symbol, amount in final_balances.items():
            price = 0.0
            change_24h = 0.0

            # Pricing logic
            if symbol in ["USDT", "USDC", "DAI", "FDUSD", "USD"]:
                price = 1.0
            else:
                pair = f"{symbol}/USDT"
                if pair in tickers:
                    price = float(tickers[pair].get("last", 0))
                    change_24h = float(tickers[pair].get("percentage", 0))
                else:
                    # Fallbacks
                    for fb in [f"{symbol}/USDC"]:
                        if fb in tickers:
                            price = float(tickers[fb].get("last", 0))
                            change_24h = float(tickers[fb].get("percentage", 0))
                            break

            # Icon Resolution
            icon_url = IconResolver.get_icon_url(
                symbol=symbol,
                asset_type=AssetType.CRYPTO,
                provider_id=self.get_provider_id(),
            )

            assets.append(
                AssetData(
                    symbol=symbol,
                    original_symbol=symbol,
                    amount=amount,
                    price=price,
                    name=symbol,  # Bybit doesn't always return full name in balance, use symbol
                    asset_type=AssetType.CRYPTO,
                    change_24h=change_24h,
                    image_url=icon_url,
                )
            )

        return assets
