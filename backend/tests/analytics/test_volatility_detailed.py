"""Detailed volatility test cases for calculation consistency."""

import asyncio
import pandas as pd
import numpy as np
from unittest.mock import MagicMock, AsyncMock

from services.analytics.base import PortfolioData
from services.analytics.calculators.volatility import VolatilityCalculator
from services.analytics.data_provider import AnalyticsDataProvider
from models.assets import AssetType


def test_get_custom_data_alignment_loss():
    """Test that get_custom_data correctly calculates alignment loss and returns per-asset data."""

    async def _test():
        provider = AnalyticsDataProvider()

        # Mock _load_prices and _load_assets_by_symbols
        # Scenario: Asset A has 250 days, Asset B has 245 days (overlapping last 245)
        dates_a = pd.date_range("2026-01-01", periods=250, freq="D", tz="UTC")
        dates_b = pd.date_range("2026-01-06", periods=245, freq="D", tz="UTC")

        df_a = pd.Series(np.linspace(100, 110, 250), index=dates_a, name="A")
        df_b = pd.Series(np.linspace(50, 55, 245), index=dates_b, name="B")

        prices_df = pd.concat([df_a, df_b], axis=1)

        # Mock DB and internal methods
        db = AsyncMock()
        provider._load_prices = AsyncMock(return_value=prices_df)

        # Mock assets for weighting
        mock_asset_a = MagicMock()
        mock_asset_a.symbol = "A"
        mock_asset_a.amount = 10
        mock_asset_a.asset_type = AssetType.CRYPTO
        mock_asset_b = MagicMock()
        mock_asset_b.symbol = "B"
        mock_asset_b.amount = 5
        mock_asset_b.asset_type = AssetType.CRYPTO

        provider._load_assets_by_symbols = AsyncMock(return_value={"A": mock_asset_a, "B": mock_asset_b})

        symbols = ["A", "B"]
        per_asset, portfolio_data, alignment_loss = await provider.get_custom_data(db, symbols)

        # 1. Check Per-Asset Data (Should be max length)
        # B should have 244 returns (245 prices)
        assert len(per_asset["A"]) == 249
        assert len(per_asset["B"]) == 244

        # 2. Check Alignment Loss
        # Asset B has a late start (missing 5 days).
        # But bfill preserves it for portfolio calculation so alignment loss is 0.
        assert portfolio_data.trading_days == 249
        assert alignment_loss == 0

    asyncio.run(_test())


def test_volatility_detailed_calculation():
    """Test calculate_detailed logic."""
    calc = VolatilityCalculator()

    # Prepare Mock Data
    dates = pd.date_range("2026-01-01", periods=100, freq="D")

    # Asset A: High Vol (random)
    returns_a = pd.Series(np.random.normal(0, 0.05, 100), index=dates)

    # Asset B: Low Vol (random), but only 20 data points
    dates_short = dates[-20:]
    returns_b = pd.Series(np.random.normal(0, 0.01, 20), index=dates_short)

    per_asset_returns = {"A": returns_a, "B": returns_b}

    # Portfolio Data (Mocked aligned version)
    # Let's say aligned is just 20 days
    aligned_returns = pd.DataFrame({"A": returns_a[-20:], "B": returns_b})
    weights = np.array([0.5, 0.5])

    # Mock Portfolio Data Object
    portfolio_data = MagicMock(spec=PortfolioData)
    # portfolio returns = dot product
    port_ret_series = aligned_returns.dot(weights)
    portfolio_data.portfolio_returns = port_ret_series
    portfolio_data.annualize_factor = np.sqrt(365)  # Crypto-like
    portfolio_data.trading_days = 20
    portfolio_data.confidence = None
    portfolio_data.actual_days = 20
    portfolio_data.status = "ready"
    portfolio_data.display_value = "10%"  # Stub

    # Mock calculate return for portfolio
    # Since we mocking calculate logic inside calculate_detailed, we rely on the real method
    # But calculate_detailed calls self.calculate().
    # Let's let it run real math if possible, or mock calculate.
    # It's cleaner to test the detailed orchestration.

    result = calc.calculate_detailed(portfolio_data, per_asset_returns, alignment_loss=80)

    # Check structure
    assert "portfolio" in result
    assert "per_asset" in result
    assert result["portfolio"]["alignment_loss"] == 80
    assert result["portfolio"]["data_points"] == 20

    # Check Pre-Asset entries
    assert len(result["per_asset"]) == 2

    item_a = next(x for x in result["per_asset"] if x["symbol"] == "A")
    item_b = next(x for x in result["per_asset"] if x["symbol"] == "B")

    assert item_a["data_points"] == 100
    assert item_b["data_points"] == 20
    assert item_a["status"] == "ready"

    # Volatility should be roughly annualized (std * sqrt(365))
    # std(0.05) * 19.1 ~ 0.95 (95%)
    assert item_a["annual_vol"] > 0.5
    assert item_b["annual_vol"] < 0.5
