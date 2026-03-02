"""Unit tests for the Volatility metric math layer."""

import pytest
import numpy as np

from services.analytics.base import AssetFilter, ConfidenceLevel, resolve_confidence, MIN_DATA_POINTS, ROLLING_WINDOW
from services.analytics.calculators.volatility import VolatilityCalculator
from tests.conftest import make_portfolio_data


class TestVolatilityMath:
    @pytest.fixture
    def calculator(self):
        return VolatilityCalculator()

    # --- Group 0: Base Utils & Properties ---

    def test_resolve_confidence_below_minimum(self):
        """resolve_confidence returns None below MIN_DATA_POINTS."""
        assert resolve_confidence(4) is None
        assert resolve_confidence(0) is None

    def test_portfolio_data_properties(self):
        """PortfolioData exposes correct confidence and returns."""
        prices = {"A": [100.0] * 6}
        data = make_portfolio_data(prices, asset_filter=AssetFilter.STOCKS)
        assert data.confidence == ConfidenceLevel.LOW
        assert len(data.portfolio_returns) == 5

    def test_weight_validation(self):
        """PortfolioData raises ValueError for invalid weights."""
        prices = {"A": [100.0] * 6, "B": [100.0] * 6}
        with pytest.raises(ValueError, match="weights must sum to ~1.0"):
            make_portfolio_data(prices, weights=[0.5, 0.4])

    def test_flat_line_volatility(self, calculator):
        """1.1 Flat line -> zero volatility."""
        prices = {"A": [100.0] * 61}  # 61 prices = 60 days
        data = make_portfolio_data(prices_dict=prices, asset_filter=AssetFilter.CRYPTO, weights=[1.0])
        result = calculator.calculate(data)

        assert result.status == "ready"
        assert result.confidence == ConfidenceLevel.HIGH
        assert result.value == 0.0
        assert result.meta["daily_vol"] == 0.0

        # Check rolling data
        rolling = [p["value"] for p in result.meta["rolling_30d"]]
        assert all(v == 0.0 for v in rolling)

    def test_insufficient_data(self, calculator):
        """1.2 Less than min data points -> insufficient status."""
        prices = {"A": [100.0] * 4}  # 3 returns
        data = make_portfolio_data(prices_dict=prices, asset_filter=AssetFilter.CRYPTO)
        result = calculator.calculate(data)
        assert result.status == "insufficient_data"
        assert result.value is None

    def test_boundary_days(self, calculator):
        """1.3 Exactly 5 data points -> ready."""
        # 6 prices = 5 returns
        prices = {"A": [100.0] * 6}
        data = make_portfolio_data(prices_dict=prices, asset_filter=AssetFilter.CRYPTO)
        result = calculator.calculate(data)
        assert result.status == "ready"
        assert result.confidence == ConfidenceLevel.LOW

    def test_single_trading_day(self, calculator):
        """1.4 Single trading day -> insufficient."""
        prices = {"A": [100.0, 105.0]}  # 1 return
        data = make_portfolio_data(prices_dict=prices, asset_filter=AssetFilter.CRYPTO)
        result = calculator.calculate(data)
        assert result.status == "insufficient_data"

    # --- Group 2: Controlled Volatility ---

    def test_alternating_returns(self, calculator):
        """2.1 Alternating prices -> known volatility."""
        # Alternating +5%, -4.76%, +5% ...
        prices_list = [100.0, 105.0] * 31  # 61 returns
        prices = {"A": prices_list}
        data = make_portfolio_data(prices_dict=prices, asset_filter=AssetFilter.STOCKS)

        # Independent calculation: compute expected volatility from raw returns
        raw_prices = np.array(prices_list)
        raw_returns = np.diff(raw_prices) / raw_prices[:-1]
        expected_daily_vol = float(np.std(raw_returns, ddof=1))
        expected_annual_vol = expected_daily_vol * np.sqrt(252)

        result = calculator.calculate(data)
        assert pytest.approx(result.value, abs=1e-4) == round(expected_annual_vol, 4)

    def test_inf_in_returns(self, calculator):
        """Zero prices produce inf returns -> should be handled gracefully."""
        # This will produce inf in pct_change()
        # 6 prices -> 5 returns. 1 inf -> 4 valid returns left.
        prices = {"A": [100.0, 0.0, 50.0, 100.0, 150.0, 200.0]}
        data = make_portfolio_data(prices_dict=prices, asset_filter=AssetFilter.STOCKS)
        result = calculator.calculate(data)

        # 5 raw returns, but 1 is inf, so 4 valid. 4 < MIN_DATA_POINTS (5)
        assert result.status == "insufficient_data"
        assert result.value is None

    def test_inf_in_returns_ready(self, calculator):
        """Zero prices produce inf returns -> should still work if enough points remain."""
        # 7 prices -> 6 returns. 1 inf -> 5 valid returns left.
        prices = {"A": [100.0, 0.0, 50.0, 100.0, 150.0, 200.0, 250.0]}
        data = make_portfolio_data(prices_dict=prices, asset_filter=AssetFilter.STOCKS)
        result = calculator.calculate(data)

        assert result.status == "ready"
        assert np.isfinite(result.value)

    def test_constant_growth(self, calculator):
        """2.2 Constant growth (fixed 1%) -> zero std."""
        # p[i] = 100 * 1.01^i
        series = [100.0 * (1.01**i) for i in range(61)]
        prices = {"A": series}
        data = make_portfolio_data(prices_dict=prices, asset_filter=AssetFilter.STOCKS)

        result = calculator.calculate(data)
        assert pytest.approx(result.value, abs=1e-5) == 0.0  # Returns are constant 0.01

    # --- Group 3: Stocks Only ---

    def test_stocks_annualize_factor(self, calculator):
        """3.1 Stocks filter -> sqrt(252)."""
        prices = {"AAPL": [150.0] * 61}
        data = make_portfolio_data(prices_dict=prices, asset_filter=AssetFilter.STOCKS)
        # Check from base.py
        assert pytest.approx(data.annualize_factor, abs=0.001) == np.sqrt(252)

    def test_two_stocks_diversification(self, calculator):
        """3.2 Diversification lowers volatility."""
        # A: +5%, -5%...
        # B: -5%, +5%...
        # Portfolio: 0%, 0%...

        returns_a = [0.05, -0.05] * 30 + [0.05]
        returns_b = [-0.05, 0.05] * 30 + [-0.05]

        prices_a = [100.0]
        prices_b = [100.0]
        for r in returns_a:
            prices_a.append(prices_a[-1] * (1 + r))
        for r in returns_b:
            prices_b.append(prices_b[-1] * (1 + r))

        prices_uncorrelated = {"A": prices_a}
        prices_hedged = {"A": prices_a, "B": prices_b}

        # Calculate isolated volatility
        data_a = make_portfolio_data(prices_dict=prices_uncorrelated, asset_filter=AssetFilter.STOCKS)
        res_a = calculator.calculate(data_a)

        # Calculate portfolio volatility with 50/50 weights
        data_p = make_portfolio_data(prices_dict=prices_hedged, weights=[0.5, 0.5], asset_filter=AssetFilter.STOCKS)
        res_p = calculator.calculate(data_p)

        # A should be volatile (> 50%)
        # P should be stable (< 1%)
        assert res_a.value > 0.5
        assert res_p.value < 0.01

    # --- Group 4: Crypto Only ---

    def test_crypto_annualize_factor(self, calculator):
        """4.1 Crypto filter -> sqrt(365)."""
        prices = {"BTC": [50000.0] * 61}
        data = make_portfolio_data(prices_dict=prices, asset_filter=AssetFilter.CRYPTO)
        assert pytest.approx(data.annualize_factor, abs=0.001) == np.sqrt(365)

    def test_stablecoin_vol(self, calculator):
        """4.3 Stablecoin should have very low vol."""
        # Fluctuation around 1.00 +/- 0.001
        np.random.seed(42)
        noise = np.random.normal(0, 0.001, 61)
        price_list = [1.0 + n for n in noise]
        prices = {"USDT": price_list}

        data = make_portfolio_data(prices_dict=prices, asset_filter=AssetFilter.CRYPTO)
        res = calculator.calculate(data)

        # Independent: compute expected vol from the same prices
        np_prices = np.array(price_list)
        raw_returns = np.diff(np_prices) / np_prices[:-1]
        expected_annual = float(np.std(raw_returns, ddof=1)) * np.sqrt(365)

        assert pytest.approx(res.value, abs=1e-4) == round(expected_annual, 4)
        assert res.value < 0.05

    # --- Group 5: Mixed Portfolio ---

    def test_mixed_dynamic_factor(self, calculator):
        """5.1 Mixed portfolio -> Dynamic annualize factor."""
        # Helper generates 61 prices = 60 days
        prices = {"BTC": [30000.0] * 61, "AAPL": [150.0] * 61}
        data = make_portfolio_data(prices_dict=prices, asset_filter=AssetFilter.ALL)

        # Independent: 60 returns over 60 calendar days -> factor = sqrt(365.25)
        # because dates are continuous (1 day diff per price)
        expected_factor = np.sqrt(365.25)
        assert pytest.approx(data.annualize_factor, abs=1e-6) == expected_factor

        # If we had gaps (weekends), trading days would be less, closer to stock factor.
        # But our simple helper doesn't simulate weekends yet. That's fine for math logic test.

    def test_stablecoin_dampening(self, calculator):
        """5.2 Stablecoin reduces portfolio vol."""
        # 1. Volatile asset only
        prices_eth = {"ETH": [2000 * (1.05 if i % 2 == 0 else 0.95) for i in range(61)]}
        data_eth = make_portfolio_data(prices_dict=prices_eth, asset_filter=AssetFilter.CRYPTO)
        res_eth = calculator.calculate(data_eth)

        # 2. Portfolio 50/50 with stablecoin (flat)
        prices_mix = {"ETH": prices_eth["ETH"], "USDT": [1.0] * 61}
        data_mix = make_portfolio_data(prices_dict=prices_mix, weights=[0.5, 0.5], asset_filter=AssetFilter.CRYPTO)
        res_mix = calculator.calculate(data_mix)

        # Volatility should be roughly half
        assert res_mix.value < res_eth.value
        assert pytest.approx(res_mix.value, rel=0.1) == res_eth.value * 0.5

    # --- Group 6: Rolling 30D Window ---

    def test_rolling_window_length(self, calculator):
        """6.1 Output meta matches input length minus window."""
        n_prices = 61  # 60 returns
        prices = {"A": [100.0] * n_prices}
        data = make_portfolio_data(prices_dict=prices, asset_filter=AssetFilter.STOCKS)
        res = calculator.calculate(data)

        rolling = res.meta["rolling_30d"]
        # n_returns = 60. Window = 30.
        # Standard rolling count: n - window + 1 = 60 - 30 + 1 = 31
        n_returns = n_prices - 1
        expected_len = n_returns - ROLLING_WINDOW + 1
        assert len(rolling) == expected_len

    def test_regime_change(self, calculator):
        """6.3 Stable to Volatile transition."""
        # First 30 days stable, next 30 days volatile
        stable = [100.0] * 31
        volatile = [100.0 * (1.05 if i % 2 == 0 else 0.95) for i in range(30)]
        prices = {"A": stable + volatile}

        data = make_portfolio_data(prices_dict=prices, asset_filter=AssetFilter.CRYPTO)
        res = calculator.calculate(data)

        rolling = res.meta["rolling_30d"]

        # First rolling point covers mostly stable period -> 0
        assert rolling[0]["value"] == 0.0

        # Last rolling point covers volatile period -> > 0
        assert rolling[-1]["value"] > 0.0

    # --- Group 7: Confidence Levels ---

    @pytest.mark.parametrize(
        "days,expected",
        [
            (4, None),  # Insufficient
            (5, ConfidenceLevel.LOW),
            (19, ConfidenceLevel.LOW),
            (20, ConfidenceLevel.MODERATE),
            (59, ConfidenceLevel.MODERATE),
            (60, ConfidenceLevel.HIGH),
            (200, ConfidenceLevel.HIGH),
        ],
    )
    def test_confidence_thresholds(self, calculator, days, expected):
        # Generate `days + 1` prices to get `days` returns
        prices = {"A": [100.0] * (days + 1)}
        data = make_portfolio_data(prices, asset_filter=AssetFilter.STOCKS)

        # Hack: calculate checks MIN_DATA_POINTS internally, but result comes from resolve_confidence
        if days < MIN_DATA_POINTS:
            res = calculator.calculate(data)
            assert res.status == "insufficient_data"
        else:
            res = calculator.calculate(data)
            assert res.confidence == expected

    # --- Group 8: Result Format ---

    def test_result_structure(self, calculator):
        """8.2 to_dict checks."""
        prices = {"A": [100.0] * 61}
        data = make_portfolio_data(prices, asset_filter=AssetFilter.STOCKS)
        res = calculator.calculate(data)

        d = res.to_dict()
        assert d["name"] == "volatility"
        assert d["display_value"] == "0.0%"
        assert d["value"] == 0.0
        assert d["status"] == "ready"
        assert d["min_days_required"] == 5
        assert "rolling_30d" in d["meta"]
