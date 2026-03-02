"""History Provider Factory.

Routes assets to the correct HistoryProvider based on their integration's
ProviderID. Designed for extensibility — adding a new provider requires only
adding an entry to PROVIDER_SOURCE_MAP and (optionally) a new HistoryProvider subclass.
"""

from typing import Dict

from models.integration import ProviderID
from services.history_provider import (
    CcxtHistoryProvider,
    HistoryProvider,
    YahooHistoryProvider,
)
from services.symbol_resolver import SymbolResolver


# ─── Static mapping: ProviderID → data source key ───────────────────────────
# "yahoo"  = Yahoo Finance (stocks, ETFs, fiat FX)
# "ccxt"   = CCXT exchange API (crypto)
#
# To add a new source:
#   1. Add a new key here (e.g. "coingecko")
#   2. Create a new HistoryProvider subclass
#   3. Add it to _PROVIDER_INSTANCES below

PROVIDER_SOURCE_MAP: Dict[ProviderID, str] = {
    ProviderID.trading212: "yahoo",
    ProviderID.freedom24: "yahoo",
    ProviderID.binance: "ccxt",
    ProviderID.bybit: "ccxt",
    ProviderID.ethereum: "ccxt",  # DeFi tokens → fallback to CCXT for major tokens
}


# ─── Shared SymbolResolver instance ──────────────────────────────────────────

_symbol_resolver = SymbolResolver.default()


# ─── Singleton provider instances ────────────────────────────────────────────

_PROVIDER_INSTANCES: Dict[str, HistoryProvider] = {
    "yahoo": YahooHistoryProvider(resolver=_symbol_resolver),
    "ccxt": CcxtHistoryProvider(exchange_id="binance"),
}


# ─── Default provider for assets with no known integration ───────────────────

_DEFAULT_SOURCE = "yahoo"


class HistoryProviderFactory:
    """Resolves the correct HistoryProvider for a given integration."""

    @staticmethod
    def get_provider(provider_id: ProviderID | None = None) -> HistoryProvider:
        """Get the HistoryProvider for a given ProviderID.

        Falls back to Yahoo if the provider_id is unknown or None.
        """
        source_key = PROVIDER_SOURCE_MAP.get(provider_id, _DEFAULT_SOURCE) if provider_id else _DEFAULT_SOURCE
        return HistoryProviderFactory.get_provider_by_source(source_key)

    @staticmethod
    def get_provider_by_source(source_key: str) -> HistoryProvider:
        """Get the HistoryProvider directly by its source key (e.g. 'yahoo', 'ccxt')."""
        return _PROVIDER_INSTANCES.get(source_key, _PROVIDER_INSTANCES[_DEFAULT_SOURCE])

    @staticmethod
    def get_source_key(provider_id: ProviderID | None = None) -> str:
        """Returns the source key string for debugging/logging."""
        if provider_id is None:
            return _DEFAULT_SOURCE
        return PROVIDER_SOURCE_MAP.get(provider_id, _DEFAULT_SOURCE)
