"""Analytics Service for portfolio calculations."""

import logging
import numpy as np
import pandas as pd
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from services.market_data import MarketDataService

logger = logging.getLogger(__name__)


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.market_data_service = MarketDataService()

    async def calculate_portfolio_metrics(
        self, portfolio_items: List[Dict[str, Any]], benchmark_symbol: str = "^GSPC"
    ) -> Dict[str, Any]:
        """Calculates comprehensive risk and performance metrics for a portfolio.

        Args:
            portfolio_items: List of dicts with 'symbol' and 'quantity'.
            benchmark_symbol: Ticker for benchmark comparison (default: S&P 500).

        Returns:
            Dict containing calculated metrics (Sharpe, VaR, etc.).
        """
        if not portfolio_items:
            return self._get_empty_metrics()

        symbols = [item["symbol"] for item in portfolio_items]

        # 1. Fetch Historical Data (Last 1 year -> 252 trading days)
        # We fetch slightly more to account for weekends/holidays
        prices_df = await self._fetch_historical_prices(symbols, days=400)

        if prices_df.empty:
            logger.warning("No historical price data found for portfolio analysis.")
            return self._get_empty_metrics()

        # 2. Forward fill missing data
        prices_df = prices_df.ffill().dropna()
        if len(prices_df) < 30:  # Need at least ~1 month of data
            return self._get_empty_metrics()

        # 3. Calculate Correct Weights
        # Find the intersection of requested symbols and available data
        valid_items = [item for item in portfolio_items if item["symbol"] in prices_df.columns]
        if not valid_items:
            return self._get_empty_metrics()

        # Determine value based on quantity * last price
        last_prices = prices_df.iloc[-1]

        total_value = 0
        weights = {}

        for item in valid_items:
            sym = item["symbol"]
            qty = item["quantity"]
            val = qty * last_prices[sym]
            total_value += val
            weights[sym] = val

        if total_value == 0:
            return self._get_empty_metrics()

        # Normalize weights
        normalized_weights = np.array([weights[item["symbol"]] / total_value for item in valid_items])
        valid_symbols = [item["symbol"] for item in valid_items]

        # 4. Calculate Portfolio Returns (Weighted Sum)
        daily_returns = prices_df.pct_change().dropna()
        # Filter columns to match valid_symbols order
        portfolio_returns = daily_returns[valid_symbols].dot(normalized_weights)

        # 5. Calculate Metrics
        metrics = {}

        # Risk
        metrics.update(self._calculate_risk_metrics(portfolio_returns, total_value))

        # Performance
        metrics.update(self._calculate_performance_metrics(portfolio_returns))

        # Market Fit (Requires Benchmark) - For now, placeholder
        # metrics.update(await self._calculate_market_fit(portfolio_returns, benchmark_symbol))
        metrics["avg_correlation"] = 0.5  # Placeholder
        metrics["beta"] = 1.0  # Placeholder
        metrics["r_squared"] = 0.85  # Placeholder

        return metrics

    async def _fetch_historical_prices(self, symbols: List[str], days: int) -> pd.DataFrame:
        """Fetches adjusted close prices for all symbols into a single DataFrame."""
        data = {}

        for symbol in symbols:
            # Trigger fetch/update (1y history)
            # This relies on the MarketDataService fetching from Yahoo Finance if needed
            try:
                await self.market_data_service.fetch_and_store_history(self.db, symbol, period="1y")
                candles = await self.market_data_service.get_candles(self.db, symbol, days=days)

                if candles:
                    # Convert to Series
                    dates = [c.timestamp for c in candles]
                    closes = [float(c.close) for c in candles]  # specific to 'close' price
                    data[symbol] = pd.Series(closes, index=dates)
            except Exception as e:
                logger.error(f"Failed to fetch history for {symbol}: {e}")
                continue

        if not data:
            return pd.DataFrame()

        # Combine into DataFrame, aligning dates
        df = pd.DataFrame(data)
        return df.sort_index()

    def _calculate_risk_metrics(self, returns: pd.Series, current_value: float) -> Dict[str, Any]:
        """Calculates Volatility, VaR, Max Drawdown."""
        # Volatility (Annualized)
        daily_vol = returns.std()
        annual_vol = daily_vol * np.sqrt(252) if not pd.isna(daily_vol) else 0

        # VaR (95% Confidence, 1 Day)
        if len(returns) > 0:
            var_95_pct = np.percentile(returns, 5)
        else:
            var_95_pct = 0

        var_95_value = current_value * var_95_pct

        # Max Drawdown
        cumulative = (1 + returns).cumprod()
        peak = cumulative.cummax()
        drawdown = (cumulative - peak) / peak
        max_drawdown = drawdown.min() if not drawdown.empty else 0

        return {
            "volatility_annual": annual_vol,
            "risk_var_95_pct": var_95_pct,
            "risk_var_95_value": var_95_value,
            "max_drawdown": max_drawdown,
        }

    def _calculate_performance_metrics(self, returns: pd.Series, risk_free_rate: float = 0.04) -> Dict[str, Any]:
        """Calculates Sharpe, Sortino."""
        annual_rf = risk_free_rate
        daily_rf = (1 + annual_rf) ** (1 / 252) - 1

        excess_returns = returns - daily_rf

        if len(excess_returns) == 0:
            return {"sharpe_ratio": 0, "sortino_ratio": 0}

        # Sharpe Ratio
        mean_excess_return = excess_returns.mean()
        std_dev = returns.std()

        if std_dev == 0 or pd.isna(std_dev):
            sharpe = 0
        else:
            sharpe = (mean_excess_return / std_dev) * np.sqrt(252)

        # Sortino Ratio (Downside deviation only)
        downside_returns = excess_returns[excess_returns < 0]
        if len(downside_returns) > 0:
            downside_std = downside_returns.std()
        else:
            downside_std = 0

        if downside_std == 0 or pd.isna(downside_std):
            sortino = 0
            # If no downside deviation but positive returns, Sortino is inherently high.
            # Could be infinity, but 0 or max cap is safer for UI.
            if mean_excess_return > 0:
                sortino = 10.0  # Cap
        else:
            sortino = (mean_excess_return / downside_std) * np.sqrt(252)

        return {"sharpe_ratio": sharpe, "sortino_ratio": sortino}

    def _get_empty_metrics(self) -> Dict[str, Any]:
        return {
            "volatility_annual": 0,
            "risk_var_95_pct": 0,
            "risk_var_95_value": 0,
            "max_drawdown": 0,
            "sharpe_ratio": 0,
            "sortino_ratio": 0,
            "avg_correlation": 0,
            "beta": 1.0,
            "r_squared": 0,
        }
