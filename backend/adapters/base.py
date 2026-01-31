from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from models.assets import AssetType

class AssetData(BaseModel):
    symbol: str
    amount: float
    price: float = 0.0
    name: Optional[str] = None
    asset_type: AssetType = AssetType.CRYPTO
    change_24h: float = 0.0
    original_symbol: Optional[str] = None
    currency: str = "USD"
    image_url: Optional[str] = None

class BaseAdapter(ABC):
    @abstractmethod
    async def validate_credentials(self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None) -> bool:
        """Validate if the provided credentials work."""
        pass

    @abstractmethod
    async def fetch_balances(self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None) -> List[AssetData]:
        """Fetch all non-zero balances from the provider."""
        pass

    @abstractmethod
    def get_provider_id(self) -> str:
        """Returns the provider identifier."""
        pass
