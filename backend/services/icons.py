import re
from typing import Dict, Callable, Optional
from models.assets import AssetType

class IconResolver:
    """
    Unified Icon Management System (Registry Pattern).
    Allows each integration to register its own icon resolution strategy.
    Provides universal fallbacks and professional asset placeholders.
    """
    # Registry of strategies: {provider_id: Callable}
    _strategies: Dict[str, Callable] = {}

    @classmethod
    def register_strategy(cls, provider_id: str, strategy: Callable):
        """Register a specific icon resolution function for a provider."""
        cls._strategies[provider_id] = strategy

    @classmethod
    def get_icon_url(cls, symbol: str, asset_type: AssetType, provider_id: str, original_ticker: str = None, asset_name: str = None) -> str:
        """
        Resolves the icon URL for a given asset.
        Logic sequence:
        1. Provider-Specific Strategy (Registry)
        2. Universal Global Fallbacks (Crypto, Stock, Fiat)
           - Tier A: Brand Extraction (Known Issuers)
           - Tier B: Name-based lookup (Cleaned Company Name)
           - Tier C: Ticker-based lookup
        3. Professional Default Placeholder (Ticker Avatar)
        """
        # 1. Try Provider-Specific Strategy
        strategy = cls._strategies.get(provider_id)
        if strategy:
            try:
                url = strategy(symbol, asset_type, original_ticker)
                if url:
                    return url
            except Exception:
                pass

        # 2. Universal Global Fallbacks
        symbol_low = symbol.lower()
        symbol_up = symbol.upper()
        raw_name = (asset_name or "").lower()
        
        # Clean company name for URL pattern
        # Remove anything in parentheses, common corporate suffixes, and non-alphanumeric chars
        name_clean = re.sub(r'\(.*?\)', '', raw_name)
        name_clean = re.sub(r'\s+(inc|plc|class [a-z]|se|co|corp|technology|technologies|group|the|holdings|ltd|s\.p\.a\.|sa)\.?$', '', name_clean.strip())
        name_clean = re.sub(r'[^a-z0-9\s-]', '', name_clean).strip().replace(' ', '-')
        name_clean = re.sub(r'-+', '-', name_clean) # Remove double hyphens

        # Major Financial Brands and common parents
        brands = [
            "vanguard", "ishares", "wisdomtree", "invesco", "amundi", 
            "lyxor", "hsbc", "spdr", "jpmorgan", "xtrackers", "blackrock",
            "fidelity", "schwab", "ark", "21shares", "coinshares", "vaneck",
            "alphabet", "google", "amazon", "apple", "microsoft", "meta", 
            "netflix", "nvidia", "tesla", "delivery-hero"
        ]

        if asset_type == AssetType.FIAT:
            currency_symbols = {"USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥", "CHF": "Fr"}
            char = currency_symbols.get(symbol_up, symbol_up[:1])
            return f"https://ui-avatars.com/api/?name={char}&background=2A2E39&color=fff&font-size=0.45&bold=true"

        if asset_type == AssetType.CRYPTO:
            return f"https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/{symbol_low}.png"
        
        if asset_type == AssetType.STOCK:
            # 2a. Brand mapping (Top priority for ETFs)
            for b in brands:
                if b in raw_name:
                    # Special case for brand variations
                    brand_id = b
                    if b in ["google", "alphabet"]: brand_id = "alphabet"
                    if b == "delivery-hero": brand_id = "delivery-hero"
                    return f"https://s3-symbol-logo.tradingview.com/{brand_id}--big.svg"

            # 2b. Cleaned name lookup (High priority for common stocks)
            if name_clean and len(name_clean) > 2:
                return f"https://s3-symbol-logo.tradingview.com/{name_clean}--big.svg"

            # 2c. Ticker lookup fallback
            ticker_clean = symbol_low.split('.')[0].split(':')[0].split('_')[0]
            return f"https://s3-symbol-logo.tradingview.com/{ticker_clean}--big.svg"
            
        # 3. Final Fallback: Professional Uniform Placeholder
        # Ensures a consistent, premium look across the board
        return "/icons/generic_asset.png"
