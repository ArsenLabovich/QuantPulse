from typing import Dict, Type
from adapters.base import BaseAdapter
from adapters.binance_adapter import BinanceAdapter
from adapters.trading212_adapter import Trading212Adapter
from models.integration import ProviderID

class AdapterFactory:
    _adapters: Dict[ProviderID, Type[BaseAdapter]] = {
        ProviderID.binance: BinanceAdapter,
        ProviderID.trading212: Trading212Adapter
    }

    @classmethod
    def get_adapter(cls, provider_id: ProviderID) -> BaseAdapter:
        adapter_class = cls._adapters.get(provider_id)
        if not adapter_class:
            raise ValueError(f"No adapter found for provider: {provider_id}")
        return adapter_class()
