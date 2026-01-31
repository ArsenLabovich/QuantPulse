
import httpx
import logging
import asyncio
from typing import Dict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class CurrencyService:
    """
    Handles exchange rates and currency conversion.
    Caches rates to minimize API calls.
    """
    _rates: Dict[str, float] = {"USD": 1.0}
    _last_updated: datetime = None
    _update_interval = timedelta(hours=1)

    @classmethod
    async def get_rate(cls, from_currency: str, to_currency: str = "USD") -> float:
        """Get exchange rate from one currency to another."""
        from_up = from_currency.upper()
        to_up = to_currency.upper()

        if from_up == to_up:
            return 1.0

        # Refresh rates if needed
        await cls._refresh_rates_if_needed()

        # Try direct rate
        if from_up == "USD" and to_up in cls._rates:
            return 1.0 / cls._rates[to_up]
        
        if to_up == "USD" and from_up in cls._rates:
            return cls._rates[from_up]

        # Try cross rate via USD
        if from_up in cls._rates and to_up in cls._rates:
            return cls._rates[from_up] / cls._rates[to_up]

        logger.warning(f"Rate not found for {from_up}/{to_up}. Falling back to 1.0")
        return 1.0

    @classmethod
    async def _refresh_rates_if_needed(cls):
        if not cls._last_updated or (datetime.now() - cls._last_updated) > cls._update_interval:
            await cls.refresh_rates()

    @classmethod
    async def refresh_rates(cls):
        """Fetch latest rates from a public API."""
        try:
            # We use a reliable free fallback or a public finance API
            # For this implementation, we use a simple public API: exchange-rate-api.com (no key required for /latest/USD)
            async with httpx.AsyncClient() as client:
                response = await client.get("https://open.er-api.com/v6/latest/USD", timeout=5.0)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("result") == "success":
                        raw_rates = data.get("rates", {})
                        # The API returns USD as base, so rates[EUR] is USD/EUR. 
                        # We want EUR -> USD, so we store inverse? 
                        # Wait, data['rates']['EUR'] = 0.92 means 1 USD = 0.92 EUR.
                        # So 1 EUR = 1/0.92 USD = 1.08 USD.
                        # For our get_rate logic, it's easier to store them as USD per currency.
                        for curr, val in raw_rates.items():
                            if val > 0:
                                cls._rates[curr] = 1.0 / val
                        
                        cls._last_updated = datetime.now()
                        logger.info(f"Exchange rates refreshed: EUR=${cls._rates.get('EUR', 0):.2f}, GBP=${cls._rates.get('GBP', 0):.2f}")
                        return
                    
            logger.error("Failed to refresh exchange rates: Invalid API response")
        except Exception as e:
            logger.error(f"Failed to refresh exchange rates: {e}")
            
        # Fallback hardcoded rates if API fails and we have nothing
        if len(cls._rates) <= 1:
            cls._rates.update({
                "EUR": 1.08,
                "GBP": 1.27,
                "JPY": 0.0067,
                "CHF": 1.13,
                "PLN": 0.25
            })
            cls._last_updated = datetime.now()

currency_service = CurrencyService()
