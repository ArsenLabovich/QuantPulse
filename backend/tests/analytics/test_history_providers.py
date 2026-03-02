"""Tests for HistoryProvider implementations and HistoryProviderFactory."""

from models.assets import AssetType
from models.integration import ProviderID
from services.history_provider import YahooHistoryProvider, CcxtHistoryProvider
from services.history_provider_factory import HistoryProviderFactory
from core.config import settings
import pytest


# ─── Factory Routing Tests ───────────────────────────────────────────────────


class TestHistoryProviderFactory:
    def test_returns_yahoo_for_trading212(self):
        provider = HistoryProviderFactory.get_provider(ProviderID.trading212)
        assert isinstance(provider, YahooHistoryProvider)

    def test_returns_yahoo_for_freedom24(self):
        provider = HistoryProviderFactory.get_provider(ProviderID.freedom24)
        assert isinstance(provider, YahooHistoryProvider)

    def test_returns_ccxt_for_binance(self):
        provider = HistoryProviderFactory.get_provider(ProviderID.binance)
        assert isinstance(provider, CcxtHistoryProvider)

    def test_returns_ccxt_for_bybit(self):
        provider = HistoryProviderFactory.get_provider(ProviderID.bybit)
        assert isinstance(provider, CcxtHistoryProvider)

    def test_returns_ccxt_for_ethereum(self):
        provider = HistoryProviderFactory.get_provider(ProviderID.ethereum)
        assert isinstance(provider, CcxtHistoryProvider)

    def test_returns_default_for_none(self):
        """None provider_id should fallback to Yahoo."""
        provider = HistoryProviderFactory.get_provider(None)
        assert isinstance(provider, YahooHistoryProvider)

    def test_source_key_for_binance(self):
        assert HistoryProviderFactory.get_source_key(ProviderID.binance) == "ccxt"

    def test_source_key_for_trading212(self):
        assert HistoryProviderFactory.get_source_key(ProviderID.trading212) == "yahoo"


# ─── Yahoo Symbol Translation Tests ─────────────────────────────────────────


class TestYahooHistoryProvider:
    def setup_method(self):
        self.provider = YahooHistoryProvider()

    def test_translate_fiat_eur(self):
        result = self.provider.translate_symbol("EUR", AssetType.FIAT)
        assert result == f"EUR{settings.BASE_CURRENCY}=X"

    def test_translate_fiat_base_currency(self):
        result = self.provider.translate_symbol(settings.BASE_CURRENCY, AssetType.FIAT)
        assert result == settings.BASE_CURRENCY

    def test_translate_stock(self):
        result = self.provider.translate_symbol("AAPL", AssetType.STOCK)
        assert result == "AAPL"

    @pytest.mark.asyncio
    async def test_db_symbol_equals_translate_for_yahoo(self):
        """For Yahoo, db_symbol and translate_symbol should return the same thing."""
        for symbol, asset_type in [("EUR", AssetType.FIAT), ("AAPL", AssetType.STOCK)]:
            assert await self.provider.db_symbol(symbol, asset_type) == self.provider.translate_symbol(
                symbol, asset_type
            )


# ─── CCXT Symbol Translation Tests ──────────────────────────────────────────


class TestCcxtHistoryProvider:
    def setup_method(self):
        self.provider = CcxtHistoryProvider(exchange_id="binance")

    def test_translate_crypto_btc(self):
        result = self.provider.translate_symbol("BTC", AssetType.CRYPTO)
        assert result == "BTC/USDT"

    def test_translate_crypto_eth(self):
        result = self.provider.translate_symbol("ETH", AssetType.CRYPTO)
        assert result == "ETH/USDT"

    @pytest.mark.asyncio
    async def test_db_symbol_crypto_btc(self):
        result = await self.provider.db_symbol("BTC", AssetType.CRYPTO)
        assert result == f"BTC-{settings.BASE_CURRENCY}"

    @pytest.mark.asyncio
    async def test_db_symbol_differs_from_translate(self):
        """For CCXT, db_symbol (BTC-USD) should differ from translate_symbol (BTC/USDT)."""
        translate = self.provider.translate_symbol("BTC", AssetType.CRYPTO)
        db_sym = await self.provider.db_symbol("BTC", AssetType.CRYPTO)
        assert translate != db_sym
        assert "/" in translate  # Exchange pair format
        assert "-" in db_sym  # DB storage format
