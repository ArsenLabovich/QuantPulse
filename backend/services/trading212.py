
import httpx
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class Trading212Client:
    LIVE_URL = "https://live.trading212.com/api/v0"
    DEMO_URL = "https://demo.trading212.com/api/v0"

    def __init__(self, api_key: str, api_secret: Optional[str] = None, is_demo: bool = False):
        self.api_key = api_key
        self.api_secret = api_secret or ""
        self.base_url = self.DEMO_URL if is_demo else self.LIVE_URL
        
        # Use Basic Auth: username=api_key, password=api_secret (or empty)
        # Verify: If user only has one key, maybe it goes in username?
        # User provided ID + Secret -> ID=user, Secret=pass. 
        self._auth = (self.api_key, self.api_secret)
        self._headers = {
            "Content-Type": "application/json"
        }

    async def _request(self, method: str, endpoint: str) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        async with httpx.AsyncClient() as client:
            try:
                response = await client.request(
                    method, 
                    url, 
                    auth=self._auth, 
                    headers=self._headers,
                    timeout=10.0
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"Trading 212 API Error [{self.base_url}]: {e.response.status_code} - {e.response.text}")
                raise
            except Exception as e:
                logger.error(f"Trading 212 Request Failed: {e}")
                raise

    async def validate_keys(self) -> Dict[str, bool]:
        """
        Validates keys by trying Live then Demo.
        Returns dict with success status and is_demo flag.
        """
        # Try Live First
        self.base_url = self.LIVE_URL
        print(f"DEBUG: Trying Live URL: {self.base_url}")
        try:
            await self.get_account_cash()
            print("DEBUG: Live Auth Success")
            return {"valid": True, "is_demo": False}
        except Exception as e:
            print(f"DEBUG: Live Auth failed: {e}")
            logger.info("Live Auth failed, trying Demo...")

        # Try Demo
        self.base_url = self.DEMO_URL
        print(f"DEBUG: Trying Demo URL: {self.base_url}")
        try:
            await self.get_account_cash()
            print("DEBUG: Demo Auth Success")
            return {"valid": True, "is_demo": True}
        except Exception as e:
            print(f"DEBUG: Demo Auth failed: {e}")
            logger.error(f"Demo Auth failed too: {e}")
            return {"valid": False, "is_demo": False}

    async def get_account_cash(self) -> Dict[str, Any]:
        """
        Fetches account cash balance.
        Ref: https://docs.trading212.com/#operation/getAccountCash
        """
        return await self._request("GET", "/equity/account/cash")

    async def get_account_metadata(self) -> Dict[str, Any]:
        """
        Fetches account metadata including currency.
        Ref: https://docs.trading212.com/#operation/getAccountInfo
        """
        return await self._request("GET", "/equity/account/info")

    async def get_instruments(self) -> List[Dict[str, Any]]:
        """
        Fetches instrument metadata (names, currencies, etc).
        Ref: https://t212public-api-docs.redoc.ly/#operation/getInstruments
        """
        return await self._request("GET", "/equity/metadata/instruments")

    async def get_open_positions(self) -> List[Dict[str, Any]]:
        """
        Fetches all open positions.
        Ref: https://docs.trading212.com/#operation/getPositions
        """
        return await self._request("GET", "/equity/portfolio")

    @staticmethod
    def normalize_ticker(ticker: str) -> str:
        """
        Removes T212 specific suffixes to get a clean ticker useful for other APIs.
        """
        ticker = ticker.upper() # Ensure uppercase
        
        if ticker.endswith("_US_EQ"):
            return ticker.replace("_US_EQ", "")
        elif ticker.endswith("_LSE"):
            return ticker.replace("_LSE", ".L")
        elif ticker.endswith("_DE"):
            return ticker.replace("_DE", ".DE")
        elif ticker.endswith("_EQ"):
             # Fallback for generic EQ, usually LSE or just raw. 
             # Try stripping it.
             return ticker.replace("_EQ", "")
        
        return ticker
