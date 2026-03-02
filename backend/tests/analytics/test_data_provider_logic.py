"""Tests for the refactored AnalyticsDataProvider with HistoryProvider abstraction."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from models.assets import UnifiedAsset, AssetType
from models.integration import ProviderID
from services.analytics.data_provider import AnalyticsDataProvider
import pandas as pd
from core.config import settings


def _make_asset(symbol, asset_type, integration_id=None):
    """Helper to create a mock UnifiedAsset."""
    return UnifiedAsset(
        symbol=symbol,
        asset_type=asset_type,
        integration_id=integration_id,
        amount=1.0,
    )


def _make_integration(provider_id: ProviderID, integration_id="test-id"):
    """Helper to create a mock Integration."""
    integration = MagicMock()
    integration.id = integration_id
    integration.provider_id = provider_id
    return integration


@pytest.mark.asyncio
async def test_load_prices_fiat_handling():
    """Base currency (USD) should generate synthetic flat 1.0 series."""
    provider = AnalyticsDataProvider()
    db = AsyncMock()
    mock_res = MagicMock()
    mock_res.all.return_value = []
    db.execute.return_value = mock_res

    assets = [
        _make_asset(settings.BASE_CURRENCY, AssetType.FIAT),
    ]

    # Mock integration loading (no integration needed for base currency)
    with patch.object(provider, "_load_integrations_for_assets", return_value={}):
        df = await provider._load_prices(db, assets)

    assert not df.empty
    assert settings.BASE_CURRENCY in df.columns
    assert (df[settings.BASE_CURRENCY] == 1.0).all()


@pytest.mark.asyncio
async def test_load_prices_timezone_aware():
    """Synthetic base-currency series should be timezone-aware (UTC)."""
    provider = AnalyticsDataProvider()
    db = AsyncMock()
    mock_res = MagicMock()
    mock_res.all.return_value = []
    db.execute.return_value = mock_res

    assets = [_make_asset(settings.BASE_CURRENCY, AssetType.FIAT)]

    with patch.object(provider, "_load_integrations_for_assets", return_value={}):
        df = await provider._load_prices(db, assets)

    assert not df.empty
    assert df.index.tz is not None
    assert str(df.index.tz) == "UTC"


@pytest.mark.asyncio
async def test_load_prices_delegates_to_correct_provider():
    """BTC from Binance should use CCXT, stock from Trading212 should use Yahoo."""
    provider = AnalyticsDataProvider()
    db = AsyncMock()
    mock_res = MagicMock()
    mock_res.all.return_value = []

    mock_candle_btc = MagicMock(symbol="BTC-USD", timestamp=pd.Timestamp("2024-01-01", tz="UTC"), close=50000.0)
    mock_candle_aapl = MagicMock(symbol="AAPL", timestamp=pd.Timestamp("2024-01-01", tz="UTC"), close=190.0)
    mock_res.scalars.return_value.all.return_value = [mock_candle_btc, mock_candle_aapl]
    db.execute.return_value = mock_res

    btc_int_id = "binance-int-id"
    stock_int_id = "t212-int-id"

    assets = [
        _make_asset("BTC", AssetType.CRYPTO, integration_id=btc_int_id),
        _make_asset("AAPL", AssetType.STOCK, integration_id=stock_int_id),
    ]

    binance_integration = _make_integration(ProviderID.binance, btc_int_id)
    t212_integration = _make_integration(ProviderID.trading212, stock_int_id)

    integration_map = {
        btc_int_id: binance_integration,
        stock_int_id: t212_integration,
    }

    mock_ccxt_provider = MagicMock()
    mock_ccxt_provider.is_fresh = AsyncMock(return_value=False)  # Cache miss → fetch
    mock_ccxt_provider.fetch_and_store = AsyncMock(return_value=365)
    mock_ccxt_provider.db_symbol = AsyncMock(return_value="BTC-USD")
    mock_ccxt_provider.get_candles = AsyncMock(
        return_value=[
            MagicMock(timestamp=pd.Timestamp("2024-01-01", tz="UTC"), close=50000.0),
            MagicMock(timestamp=pd.Timestamp("2024-01-02", tz="UTC"), close=51000.0),
        ]
    )

    mock_yahoo_provider = MagicMock()
    mock_yahoo_provider.is_fresh = AsyncMock(return_value=False)  # Cache miss → fetch
    mock_yahoo_provider.fetch_and_store = AsyncMock(return_value=252)
    mock_yahoo_provider.db_symbol = AsyncMock(return_value="AAPL")
    mock_yahoo_provider.get_candles = AsyncMock(
        return_value=[
            MagicMock(timestamp=pd.Timestamp("2024-01-01", tz="UTC"), close=190.0),
            MagicMock(timestamp=pd.Timestamp("2024-01-02", tz="UTC"), close=191.0),
        ]
    )

    def mock_get_provider(pid):
        if pid == ProviderID.binance:
            return mock_ccxt_provider
        return mock_yahoo_provider

    def mock_get_source_key(pid):
        if pid == ProviderID.binance:
            return "ccxt"
        return "yahoo"

    def mock_get_provider_by_source(key):
        if key == "ccxt":
            return mock_ccxt_provider
        return mock_yahoo_provider

    mock_redis = AsyncMock()
    mock_redis.mget.return_value = [b""] * 10
    mock_redis.get.return_value = None

    mock_session_factory = MagicMock()
    mock_session = AsyncMock()
    mock_session_factory.return_value.__aenter__.return_value = mock_session

    with (
        patch.object(provider, "_load_integrations_for_assets", return_value=integration_map),
        patch("services.analytics.data_provider.HistoryProviderFactory") as mock_factory,
        patch("services.analytics.data_provider.get_redis_client", return_value=mock_redis),
        patch("core.database.get_async_sessionmaker", return_value=mock_session_factory),
    ):
        mock_factory.get_provider.side_effect = mock_get_provider
        mock_factory.get_source_key.side_effect = mock_get_source_key
        mock_factory.get_provider_by_source.side_effect = mock_get_provider_by_source

        df = await provider._load_prices(db, assets)

    # BTC should be fetched via CCXT
    mock_ccxt_provider.fetch_and_store.assert_called_once()
    args, kwargs = mock_ccxt_provider.fetch_and_store.call_args
    assert args[1] == "BTC"
    assert args[2] == AssetType.CRYPTO
    assert kwargs.get("name") is None
    assert kwargs.get("period") == "1y"
    mock_ccxt_provider.db_symbol.assert_called_with("BTC", AssetType.CRYPTO, name=None, isin=None)

    # AAPL should be fetched via Yahoo
    mock_yahoo_provider.fetch_and_store.assert_called_once()
    args, kwargs = mock_yahoo_provider.fetch_and_store.call_args
    assert args[1] == "AAPL"
    assert args[2] == AssetType.STOCK
    assert kwargs.get("period") == "1y"
    mock_yahoo_provider.db_symbol.assert_called_with("AAPL", AssetType.STOCK, name=None, isin=None)

    assert "BTC" in df.columns
    assert "AAPL" in df.columns
