"""Standalone benchmark: volatility computation time.

No project dependencies required — pure numpy/pandas math,
mirrors the exact logic from VolatilityCalculator.
"""

import time
import numpy as np
import pandas as pd


ROLLING_WINDOW = 30
MIN_DATA_POINTS = 5


def calculate_volatility(returns: pd.Series, annualize_factor: float):
    """Mirrors VolatilityCalculator.calculate() logic."""
    portfolio_returns = returns.replace([np.inf, -np.inf], np.nan).dropna()
    if len(portfolio_returns) < MIN_DATA_POINTS:
        return None

    daily_vol = float(portfolio_returns.std(ddof=1))
    annual_vol = daily_vol * annualize_factor

    rolling_series = portfolio_returns.rolling(ROLLING_WINDOW).std(ddof=1) * annualize_factor
    rolling_clean = rolling_series.dropna()
    rolling_data = [{"date": str(dt.date()), "value": round(float(v) * 100, 2)} for dt, v in rolling_clean.items()]

    return {
        "annual_vol": round(annual_vol, 4),
        "daily_vol": round(daily_vol, 6),
        "rolling_count": len(rolling_data),
    }


def calculate_detailed(prices_df, weights, symbols, annualize_factor):
    """Mirrors VolatilityCalculator.calculate_detailed() logic."""
    returns_df = prices_df.pct_change().iloc[1:]
    portfolio_returns = returns_df[symbols].dot(weights)

    # Portfolio volatility
    portfolio_result = calculate_volatility(portfolio_returns, annualize_factor)

    # Per-asset volatility
    per_asset = []
    for sym in symbols:
        asset_ret = returns_df[sym].replace([np.inf, -np.inf], np.nan).dropna()
        if len(asset_ret) < MIN_DATA_POINTS:
            per_asset.append({"symbol": sym, "status": "insufficient_data"})
            continue

        trading_days = len(asset_ret)
        calendar_days = (asset_ret.index[-1] - asset_ret.index[0]).days
        if calendar_days > 0:
            factor = np.sqrt(trading_days / (calendar_days / 365.25))
        else:
            factor = np.sqrt(252)

        daily = float(asset_ret.std(ddof=1))
        annual = daily * float(factor)
        per_asset.append({"symbol": sym, "annual_vol": round(annual, 4), "status": "ready"})

    return {"portfolio": portfolio_result, "per_asset": per_asset}


def make_bench_data(n_assets, n_days=365):
    np.random.seed(42)
    symbols = [f"A{i}" for i in range(n_assets)]
    data = {}
    for sym in symbols:
        returns = np.random.normal(0.001, 0.02, n_days)
        data[sym] = (100.0 * np.cumprod(1 + returns)).tolist()

    df = pd.DataFrame(data)
    df.index = pd.date_range("2024-01-01", periods=n_days, freq="D")
    weights = np.ones(n_assets) / n_assets
    return df, weights, symbols


def bench(func, runs=100):
    # warm up
    func()

    times = []
    for _ in range(runs):
        start = time.perf_counter()
        func()
        times.append((time.perf_counter() - start) * 1000)
    return np.mean(times), np.std(times), np.median(times), np.max(times)


if __name__ == "__main__":
    factor = float(np.sqrt(252))

    # ── PART 1: calculate() — varying asset count ──
    print("=" * 85)
    print("BENCHMARK: Portfolio Volatility  (calculate)  —  365 days")
    print("=" * 85)
    print(f"{'Assets':>8} | {'Mean ms':>9} | {'Std ms':>8} | {'Median ms':>10} | {'Max ms':>8}")
    print("-" * 58)

    for n in [1, 2, 3, 5, 10, 15, 20, 30, 50]:
        df, w, syms = make_bench_data(n, 365)
        returns_df = df.pct_change().iloc[1:]

        def run_calc(r=returns_df, ww=w, s=syms):
            pr = r[s].dot(ww)
            return calculate_volatility(pr, factor)

        mean, std, med, mx = bench(run_calc, runs=200)
        print(f"{n:>8} | {mean:>9.3f} | {std:>8.3f} | {med:>10.3f} | {mx:>8.3f}")

    # ── PART 2: calculate_detailed() — varying asset count ──
    print()
    print("=" * 85)
    print("BENCHMARK: Detailed Volatility  (calculate_detailed)  —  365 days")
    print("=" * 85)
    print(f"{'Assets':>8} | {'Mean ms':>9} | {'Std ms':>8} | {'Median ms':>10} | {'Max ms':>8}")
    print("-" * 58)

    for n in [1, 2, 3, 5, 10, 15, 20, 30, 50]:
        df, w, syms = make_bench_data(n, 365)

        def run_det(d=df, ww=w, s=syms):
            return calculate_detailed(d, ww, s, factor)

        mean, std, med, mx = bench(run_det, runs=100)
        print(f"{n:>8} | {mean:>9.3f} | {std:>8.3f} | {med:>10.3f} | {mx:>8.3f}")

    # ── PART 3: calculate() — varying data points ──
    print()
    print("=" * 85)
    print("BENCHMARK: Portfolio Volatility  —  10 assets, varying days")
    print("=" * 85)
    print(f"{'Days':>8} | {'Mean ms':>9} | {'Std ms':>8} | {'Median ms':>10} | {'Max ms':>8}")
    print("-" * 58)

    for days in [30, 60, 90, 180, 365, 730, 1460]:
        df, w, syms = make_bench_data(10, days)
        returns_df = df.pct_change().iloc[1:]

        def run_days(r=returns_df, ww=w, s=syms):
            pr = r[s].dot(ww)
            return calculate_volatility(pr, factor)

        mean, std, med, mx = bench(run_days, runs=200)
        print(f"{days:>8} | {mean:>9.3f} | {std:>8.3f} | {med:>10.3f} | {mx:>8.3f}")

    print()
    print("Done.")
