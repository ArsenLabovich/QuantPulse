"""Analytics API Router (Stub)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
# from core.security import get_current_user # CAUSES CRASH: ImportError
# from models import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
async def get_analytics_summary(
    db: AsyncSession = Depends(get_db),
    # current_user: User = Depends(get_current_user) # Disabled for stability
):
    """Stub endpoint to return empty analytics data (backend stabilization)."""
    return {
        "sharpe_ratio": "--",
        "sortino_ratio": "--",
        "treynor_ratio": "--",
        "monte_carlo_sim": "--",
        "risk_var_95": "--",
        "max_drawdown": "--",
        "volatility_annual": "--",
        "beta": "--",
        "correlation_status": "--",
        "r_squared": "--",
    }
