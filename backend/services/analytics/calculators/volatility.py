"""Annualized portfolio volatility calculator."""

from typing import Dict
import numpy as np
import pandas as pd
from services.analytics.base import (
    MetricResult,
    PortfolioData,
    MIN_DATA_POINTS,
    resolve_confidence,
    ROLLING_WINDOW,
)


class VolatilityCalculator:
    """Calculates annualized standard deviation of portfolio returns."""

    name = "volatility"

    def calculate(self, data: PortfolioData) -> MetricResult:
        if data.trading_days < MIN_DATA_POINTS:
            return MetricResult.insufficient_data(self.name, data.trading_days)

        portfolio_returns = data.portfolio_returns

        # Guard: replace inf values from zero-price divisions and drop NaNs
        portfolio_returns = portfolio_returns.replace([np.inf, -np.inf], np.nan).dropna()
        if len(portfolio_returns) < MIN_DATA_POINTS:
            return MetricResult.insufficient_data(self.name, data.trading_days)

        # Sample std (ddof=1) — standard for financial volatility estimation
        daily_vol = float(portfolio_returns.std(ddof=1))
        annual_vol = daily_vol * data.annualize_factor
        confidence = resolve_confidence(data.trading_days)

        rolling_series = portfolio_returns.rolling(ROLLING_WINDOW).std(ddof=1) * data.annualize_factor
        rolling_clean = rolling_series.dropna()
        rolling_data = [{"date": str(dt.date()), "value": round(float(v) * 100, 2)} for dt, v in rolling_clean.items()]

        return MetricResult(
            name=self.name,
            value=round(annual_vol, 4),
            display_value=f"{annual_vol * 100:.1f}%",
            status="ready",
            confidence=confidence,
            meta={
                "daily_vol": round(daily_vol, 6),
                "annualize_factor": round(data.annualize_factor, 4),
                "rolling_30d": rolling_data,
            },
            min_days_required=MIN_DATA_POINTS,
            actual_days=data.trading_days,
        )

    def calculate_detailed(
        self,
        portfolio_data: PortfolioData,
        per_asset_returns: Dict[str, pd.Series],
        alignment_loss: int,
    ) -> Dict:
        """Computes detailed volatility metrics.

        1. Overall portfolio volatility (using aligned data).
        2. Per-asset volatility (using max available data per asset).
        """
        # 1. Portfolio Volatility
        portfolio_result = self.calculate(portfolio_data)

        portfolio_meta = portfolio_result.meta or {}
        portfolio_out = {
            "annual_vol": portfolio_result.value,
            "daily_vol": portfolio_meta.get("daily_vol"),
            "display_value": portfolio_result.display_value,
            "data_points": portfolio_result.actual_days,
            "alignment_loss": alignment_loss,
            "confidence": portfolio_result.confidence.value if portfolio_result.confidence else None,
            "rolling_30d": portfolio_meta.get("rolling_30d", []),
            "status": portfolio_result.status,
        }

        # 2. Per-Asset Volatility
        per_asset_out = []

        # Annualization factor for per-asset might differ if their ranges are different
        # but for simplicity and comparability, we often use standard 252 or crypto 365
        # depending on asset type, OR we calculate dynamic factor per asset.
        # Let's use the dynamic factor logic locally for each asset to be precise.

        for symbol, returns in per_asset_returns.items():
            if len(returns) < MIN_DATA_POINTS:
                per_asset_out.append(
                    {
                        "symbol": symbol,
                        "daily_vol": None,
                        "annual_vol": None,
                        "data_points": len(returns),
                        "status": "insufficient_data",
                    }
                )
                continue

            # Calculate individual factor
            # We don't have the calendar range here easily unless we pass prices.
            # But returns index has dates.
            trading_days = len(returns)
            calendar_days = (returns.index[-1] - returns.index[0]).days
            if calendar_days > 0:
                factor = np.sqrt(trading_days / (calendar_days / 365.25))
            else:
                factor = np.sqrt(252)

            daily = float(returns.std(ddof=1))
            annual = daily * float(factor)

            per_asset_out.append(
                {
                    "symbol": symbol,
                    "daily_vol": round(daily, 6),
                    "annual_vol": round(annual, 4),
                    "data_points": trading_days,
                    "status": "ready",
                }
            )

        return {"portfolio": portfolio_out, "per_asset": per_asset_out}
