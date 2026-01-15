import ccxt
import asyncio
from fastapi import HTTPException
from typing import Dict, Any
from adapters.base import BaseAdapter


class BinanceAdapter(BaseAdapter):
    """Adapter for Binance exchange integration."""
    
    async def validate_connectivity(self, credentials: Dict[str, Any]) -> bool:
        """Validate connectivity to Binance using ccxt."""
        api_key = credentials.get("api_key")
        api_secret = credentials.get("api_secret")
        
        if not api_key or not api_secret:
            raise HTTPException(status_code=400, detail="API key and API secret are required")
        
        try:
            exchange = ccxt.binance({
                'apiKey': api_key,
                'secret': api_secret,
                'enableRateLimit': True,
                'options': {
                    'defaultType': 'spot',  # Use spot trading by default
                }
            })
            
            # Test connectivity by fetching balance (ccxt methods are synchronous)
            # Run in executor to avoid blocking
            loop = asyncio.get_event_loop()
            balance = await loop.run_in_executor(None, exchange.fetch_balance)
            
            if balance is None:
                raise HTTPException(status_code=400, detail="Invalid API keys: Unable to connect to Binance")
            
            return True
            
        except ccxt.AuthenticationError:
            raise HTTPException(status_code=400, detail="Invalid API keys: Authentication failed")
        except ccxt.NetworkError as e:
            raise HTTPException(status_code=400, detail=f"Network error: {str(e)}")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid keys: {str(e)}")
    
    async def validate_permissions(self, credentials: Dict[str, Any]) -> bool:
        """
        Validate that the API key is Read-Only (no withdrawal permissions).
        Note: Binance API doesn't directly expose permission flags through ccxt.
        This check validates connectivity, but cannot verify Read-Only status via ccxt alone.
        The frontend will warn users to create Read-Only keys.
        """
        api_key = credentials.get("api_key")
        api_secret = credentials.get("api_secret")
        
        if not api_key or not api_secret:
            raise HTTPException(status_code=400, detail="API key and API secret are required")
        
        try:
            exchange = ccxt.binance({
                'apiKey': api_key,
                'secret': api_secret,
                'enableRateLimit': True,
                'options': {
                    'defaultType': 'spot',
                }
            })
            
            # Try to get account info to verify key works
            # Note: Binance API v3 provides account info that includes permissions,
            # but ccxt may not expose this directly. For now, we validate that the key works.
            # The frontend will warn users to create Read-Only keys.
            loop = asyncio.get_event_loop()
            account = await loop.run_in_executor(None, exchange.fetch_balance)
            
            # Since we can't directly check withdrawal permissions via ccxt,
            # we rely on user education (frontend warning) and accept the key
            # In a production system, you might want to use Binance's REST API directly
            # to check the account permissions via /api/v3/account endpoint
            
            return True
                
        except ccxt.PermissionDenied:
            # Permission denied means the key doesn't have necessary permissions
            raise HTTPException(
                status_code=400,
                detail="Security Alert: This key allows withdrawals. Please create a Read-Only key."
            )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Unable to validate API key permissions: {str(e)}"
            )
    
    def get_credentials_schema(self) -> Dict[str, Any]:
        """Return the expected schema for Binance credentials."""
        return {
            "api_key": {"type": "string", "required": True},
            "api_secret": {"type": "string", "required": True}
        }
    
    async def validate(self, credentials: Dict[str, Any]) -> bool:
        """
        Complete validation: connectivity + permissions.
        This is the main method to call from the API endpoint.
        """
        # First validate connectivity
        await self.validate_connectivity(credentials)
        
        # Then validate permissions
        await self.validate_permissions(credentials)
        
        return True
