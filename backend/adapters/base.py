from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseAdapter(ABC):
    """Base class for integration adapters."""
    
    @abstractmethod
    async def validate_connectivity(self, credentials: Dict[str, Any]) -> bool:
        """
        Validate that the credentials can connect to the provider.
        Returns True if connection is successful, raises HTTPException otherwise.
        """
        pass
    
    @abstractmethod
    async def validate_permissions(self, credentials: Dict[str, Any]) -> bool:
        """
        Validate that the credentials have the required permissions (e.g., Read-Only).
        Returns True if permissions are valid, raises HTTPException otherwise.
        """
        pass
    
    @abstractmethod
    def get_credentials_schema(self) -> Dict[str, Any]:
        """
        Return the expected schema for credentials (for validation).
        """
        pass
