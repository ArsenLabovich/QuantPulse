"""Annualized portfolio volatility calculator."""

from services.analytics.base import (
    MetricResult,
    PortfolioData,
    MIN_DATA_POINTS,
    resolve_confidence,
)

_ROLLING_WINDOW = 30


class VolatilityCalculator:
    """Calculates annualized standard deviation of portfolio returns."""

    name = "volatility"

    def calculate(self, data: PortfolioData) -> MetricResult:
        if data.trading_days < MIN_DATA_POINTS:
            return MetricResult.insufficient_data(self.name, data.trading_days)

        portfolio_returns = data.portfolio_returns
        daily_vol = float(portfolio_returns.std())
        annual_vol = daily_vol * data.annualize_factor
        confidence = resolve_confidence(data.trading_days)

        rolling_series = portfolio_returns.rolling(_ROLLING_WINDOW).std() * data.annualize_factor
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
