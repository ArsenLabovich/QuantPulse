"""Pytest fixtures and helpers for analytics tests."""

import datetime
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

from services.analytics.base import ANNUALIZE_FACTORS, AssetFilter, PortfolioData


def make_portfolio_data(
    prices_dict: Dict[str, List[float]],
    weights: Optional[List[float]] = None,
    asset_filter: AssetFilter = AssetFilter.ALL,
    annualize_factor: Optional[float] = None,
) -> PortfolioData:
    """Helper to create minimal valid PortfolioData for testing."""
    df = pd.DataFrame(prices_dict)

    # Generate dates. Must match data length
    n_rows = len(df)
    dates = [datetime.date(2023, 1, 1) + datetime.timedelta(days=i) for i in range(n_rows)]
    df.index = pd.DatetimeIndex(dates)

    returns_df = df.pct_change().iloc[1:]  # First row is NaN

    symbols = list(prices_dict.keys())

    if weights is None:
        if not symbols:
            weights_arr = np.array([])
        else:
            n = len(symbols)
            weights_arr = np.array([1.0 / n] * n)
    else:
        weights_arr = np.array(weights)

    # Use explicit factor if given, otherwise use predefined constants
    if annualize_factor is not None:
        _factor = float(annualize_factor)
    elif asset_filter in ANNUALIZE_FACTORS:
        _factor = float(ANNUALIZE_FACTORS[asset_filter])
    else:
        # For AssetFilter.ALL in tests, default to daily continuous data sqrt(365.25)
        _factor = float(np.sqrt(365.25))

    return PortfolioData(
        prices_df=df,
        returns_df=returns_df,
        weights=weights_arr,
        symbols=symbols,
        asset_filter=asset_filter,
        annualize_factor=_factor,
        trading_days=len(returns_df),
        total_value_usd=10_000.0,
    )
