"""Base types for the analytics module."""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd


class AssetFilter(str, enum.Enum):
    ALL = "all"
    CRYPTO = "crypto"
    STOCKS = "stocks"


class ConfidenceLevel(str, enum.Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


# Order matters: resolve_confidence() iterates HIGH → MODERATE → LOW
# and returns the first match. Do not reorder without updating that function.
CONFIDENCE_THRESHOLDS = {
    ConfidenceLevel.HIGH: 60,
    ConfidenceLevel.MODERATE: 20,
    ConfidenceLevel.LOW: 5,
}

MIN_DATA_POINTS = 5
ROLLING_WINDOW = 30


def resolve_confidence(trading_days: int) -> Optional[ConfidenceLevel]:
    """Determine confidence level based on available trading days."""
    for level in (ConfidenceLevel.HIGH, ConfidenceLevel.MODERATE, ConfidenceLevel.LOW):
        if trading_days >= CONFIDENCE_THRESHOLDS[level]:
            return level
    return None


ANNUALIZE_FACTORS = {
    AssetFilter.CRYPTO: np.sqrt(365),
    AssetFilter.STOCKS: np.sqrt(252),
}


@dataclass
class PortfolioData:
    """Aligned portfolio data ready for metric calculation."""

    prices_df: pd.DataFrame
    returns_df: pd.DataFrame
    weights: np.ndarray
    symbols: List[str]
    asset_filter: AssetFilter
    annualize_factor: float
    trading_days: int
    total_value_usd: float

    @property
    def portfolio_returns(self) -> pd.Series:
        """Weighted portfolio returns."""
        return self.returns_df[self.symbols].dot(self.weights)

    def __post_init__(self):
        """Validate portfolio data structure."""
        if len(self.weights) > 0:
            total = float(np.sum(self.weights))
            # Allow 1% rounding error
            if abs(total - 1.0) > 0.01:
                raise ValueError(f"Portfolio weights must sum to ~1.0, got {total:.4f}")

    @property
    def confidence(self) -> Optional[ConfidenceLevel]:
        return resolve_confidence(self.trading_days)


@dataclass
class MetricResult:
    """Standardized output from any metric calculator."""

    name: str
    value: Optional[float]
    display_value: str
    status: str
    confidence: Optional[ConfidenceLevel]
    meta: Dict[str, Any] = field(default_factory=dict)
    min_days_required: int = MIN_DATA_POINTS
    actual_days: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "display_value": self.display_value,
            "status": self.status,
            "confidence": self.confidence.value if self.confidence else None,
            "meta": self.meta,
            "min_days_required": self.min_days_required,
            "actual_days": self.actual_days,
        }

    @staticmethod
    def insufficient_data(name: str, actual_days: int, min_days: int = MIN_DATA_POINTS) -> MetricResult:
        return MetricResult(
            name=name,
            value=None,
            display_value="--",
            status="insufficient_data",
            confidence=None,
            meta={"message": f"Minimum {min_days} trading days required, got {actual_days}"},
            min_days_required=min_days,
            actual_days=actual_days,
        )
