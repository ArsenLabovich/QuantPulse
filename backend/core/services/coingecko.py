
import httpx
import logging
import asyncio
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class CoinGeckoService:
    def __init__(self):
        self._symbol_map: Dict[str, str] = {}
        self._last_update = 0
        self._cache_ttl = 3600 * 24  # 24 hours
        
    async def _fetch_top_coins(self):
        """
        Fetches top 500 coins by market cap to populate the symbol map.
        Prioritizes high market cap coins for symbol matching.
        """
        try:
            url = "https://api.coingecko.com/api/v3/coins/markets"
            params = {
                "vs_currency": "usd",
                "order": "market_cap_desc",
                "per_page": 250,
                "page": 1,
                "sparkline": False
            }
            
            async with httpx.AsyncClient() as client:
                # Fetch page 1 (Top 250)
                logger.info("Fetching Top 250 coins from CoinGecko...")
                r1 = await client.get(url, params=params, timeout=10.0)
                if r1.status_code == 200:
                    data1 = r1.json()
                    self._process_data(data1)
                
                # Fetch page 2 (Next 250)
                params["page"] = 2
                logger.info("Fetching Next 250 coins from CoinGecko...")
                r2 = await client.get(url, params=params, timeout=10.0)
                if r2.status_code == 200:
                    data2 = r2.json()
                    self._process_data(data2)
                
                self._last_update = asyncio.get_event_loop().time()
                
        except Exception as e:
            logger.error(f"Failed to fetch CoinGecko data: {e}")

    def _process_data(self, data):
        for coin in data:
            symbol = coin['symbol'].upper()
            name = coin['name']
            
            # Only set if not already present (Preserve higher market cap priority)
            if symbol not in self._symbol_map:
                self._symbol_map[symbol] = name

    async def get_coin_name(self, symbol: str) -> str:
        """
        Returns the full name for a given symbol (e.g. "BTC" -> "Bitcoin").
        Refreshes cache if empty or expired.
        """
        symbol = symbol.upper()
        
        # Initial load or refresh
        if not self._symbol_map:
            await self._fetch_top_coins()
            
        return self._symbol_map.get(symbol, symbol)

    def get_map(self) -> Dict[str, str]:
        return self._symbol_map

coingecko_service = CoinGeckoService()
