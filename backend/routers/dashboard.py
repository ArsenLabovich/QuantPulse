from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional
import datetime

from core.database import get_db
from models.user import User
from models.assets import UnifiedAsset, PortfolioSnapshot
from core.deps import get_current_user
from models.integration import Integration
from worker.tasks import sync_integration_data
from pydantic import BaseModel

# ... existing code ...


from celery.result import AsyncResult

# ... existing code ...

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.post("/refresh")
async def refresh_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Init SyncManager (should ideally be dependency injected, but doing inline for now)
    # We need a Redis client.
    from redis import Redis
    import os
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    # Quick parse to get host/port? Or just use from_url
    redis_client = Redis.from_url(redis_url)
    
    from services.sync_manager import SyncManager
    sync_manager = SyncManager(redis_client)

    # 2. Check Cooldown
    remaining = sync_manager.get_remaining_cooldown(current_user.id)
    if remaining > 0:
        raise HTTPException(
            status_code=429,
            detail={
                "message": "Sync cooldown active",
                "retry_after": remaining
            }
        )

    # 3. Find active integration
    result = await db.execute(
        select(Integration)
        .where(
            Integration.user_id == current_user.id,
            Integration.is_active == True
        )
        .limit(1)
    )
    integration = result.scalar_one_or_none()
    
    if not integration:
        # If no integration, technically we can't sync.
        # But maybe we should let them "sync" empty state?
        # For now, keep existing behavior.
        raise HTTPException(status_code=404, detail="No active integration found")
        
    # 4. Trigger Sync
    task_id = sync_manager.trigger_sync(current_user.id, integration.id)
    
    return {"status": "started", "task_id": task_id}

from celery.result import AsyncResult
from worker.celery_app import celery_app

# ... existing code ...

@router.get("/status/{task_id}")
async def get_task_status(task_id: str, current_user: User = Depends(get_current_user)):
    # Need SyncManager to clear active task on success
    from redis import Redis
    import os
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    redis_client = Redis.from_url(redis_url)
    from services.sync_manager import SyncManager
    sync_manager = SyncManager(redis_client)

    task_result = AsyncResult(task_id, app=celery_app)
    
    try:
        # Accessing .status or .result might trigger backend lookup which can fail if Redis data is corrupt
        status = task_result.status
        if task_result.ready():
            res = task_result.result
            if isinstance(res, Exception):
                result = str(res)
            else:
                result = res
            
            # If success, clear active task and set last sync time
            if status == "SUCCESS":
                 sync_manager.clear_active_task(current_user.id)
                 sync_manager.set_last_sync_time(current_user.id)

        else:
            result = None
            
        info = task_result.info
        info_data = info if isinstance(info, dict) else str(info)
        
    except Exception as e:
        # Fallback if Celery fails to read result (e.g. ValueError: Exception info must include...)
        print(f"Celery Result Read Error: {e}")
        return {
            "task_id": task_id,
            "status": "FAILURE",
            "result": str(e),
            "info": {"error": "Failed to read task state"}
        }

    return {
        "task_id": task_id,
        "status": status,
        "result": result,
        "info": info_data
    }


@router.get("/sync-status")
async def get_sync_status(current_user: User = Depends(get_current_user)):
    # Init SyncManager
    from redis import Redis
    import os
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    redis_client = Redis.from_url(redis_url)
    
    from services.sync_manager import SyncManager
    sync_manager = SyncManager(redis_client)
    
    remaining = sync_manager.get_remaining_cooldown(current_user.id)
    active_task = sync_manager.get_active_task(current_user.id)
    last_sync = sync_manager.get_last_sync_time(current_user.id)

    return {
        "remaining_cooldown": remaining, 
        "active_task_id": active_task,
        "last_sync_time": last_sync,
        "auto_sync_interval": SyncManager.AUTO_SYNC_INTERVAL
    }



class AllocationItem(BaseModel):
    name: str
    value: float
    percentage: float
    color: Optional[str] = None

class HistoryItem(BaseModel):
    date: str
    value: float

class DashboardSummary(BaseModel):
    net_worth: float
    daily_change: float
    allocation: List[AllocationItem]
    history: List[HistoryItem]

@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Calculate Net Worth
    # Sum of all assets for this user
    result = await db.execute(
        select(func.sum(UnifiedAsset.usd_value))
        .where(UnifiedAsset.user_id == current_user.id)
    )
    total_net_worth = result.scalar() or 0.0
    total_net_worth = float(total_net_worth)

    # 2. Daily Change
    # Find snapshot from ~24h ago
    yesterday = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
    
    # Get the snapshot closest to 24h ago
    # For now, let's just get the latest snapshot BEFORE yesterday? 
    # Or just get the first snapshot available if history is short.
    # Logic: Get latest snapshot. If total_net_worth is live, compare with latest-1?
    # Actually, let's look for a snapshot created < 24h ago but > 48h ago?
    # Simple logic: Compare with the snapshot that is closest to "24h ago".
    
    # Let's simple it down: Get the MOST RECENT snapshot (if we assume live value is newer) 
    # No, live value IS the most recent. We need previous day.
    
    history_result = await db.execute(
        select(PortfolioSnapshot)
        .where(
            PortfolioSnapshot.user_id == current_user.id,
            PortfolioSnapshot.timestamp <= yesterday
        )
        .order_by(desc(PortfolioSnapshot.timestamp))
        .limit(1)
    )
    prev_snapshot = history_result.scalar_one_or_none()
    
    daily_change = 0.0
    if prev_snapshot and float(prev_snapshot.total_value_usd) > 0:
        prev_val = float(prev_snapshot.total_value_usd)
        daily_change = ((total_net_worth - prev_val) / prev_val) * 100
    else:
        # Fallback: if no old snapshot, compare with earliest available snapshot?
        # Or just 0.
        pass

    # 3. Allocation
    # Group by Name (if available) or Symbol, order by Value DESC
    # We use coalesce to prefer 'name' over 'symbol' for grouping label
    
    # Logic:
    # 1. Group by (name, symbol) pair is likely safest if we want to preserve both.
    # But usually we just want to group by the display label.
    # Let's group by the NORMALIZED symbol (which is what we save in .symbol now)
    # AND fetch the name.
    
    # Actually, simpler:
    # We saved normalized 'symbol' (e.g. BTC) and 'name' (e.g. Bitcoin) in the DB.
    # So we can just Group By (symbol, name).
    
    assets_result = await db.execute(
        select(
            UnifiedAsset.symbol, 
            UnifiedAsset.name,
            func.sum(UnifiedAsset.usd_value).label("total_value")
        )
        .where(UnifiedAsset.user_id == current_user.id)
        .group_by(UnifiedAsset.symbol, UnifiedAsset.name)
        .order_by(desc("total_value"))
    )
    assets = assets_result.all()
    
    allocation = []
    other_value = 0.0
    
    # Take top 5, group rest as "Other"
    for i, (symbol, name, val) in enumerate(assets):
        val = float(val or 0)
        display_name = name if name else symbol
        
        if val <= 0: continue
        
        if i < 5:
            percent = (val / total_net_worth * 100) if total_net_worth > 0 else 0
            allocation.append(AllocationItem(
                name=display_name,
                value=val,
                percentage=round(percent, 2)
            ))
        else:
            other_value += val
            
    if other_value > 0:
        percent = (other_value / total_net_worth * 100) if total_net_worth > 0 else 0
        allocation.append(AllocationItem(
            name="Other",
            value=other_value,
            percentage=round(percent, 2)
        ))

    # 4. History (Chart Data)
    # Get last 30 days of snapshots
    month_ago = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=30)
    history_query = await db.execute(
        select(PortfolioSnapshot)
        .where(
            PortfolioSnapshot.user_id == current_user.id,
            PortfolioSnapshot.timestamp >= month_ago
        )
        .order_by(PortfolioSnapshot.timestamp)
    )
    snapshots = history_query.scalars().all()
    
    history = [
        HistoryItem(
            date=s.timestamp.strftime("%Y-%m-%d %H:%M"), 
            value=float(s.total_value_usd)
        ) for s in snapshots
    ]

    return DashboardSummary(
        net_worth=total_net_worth,
        daily_change=round(daily_change, 2),
        allocation=allocation,
        history=history
    )

@router.get("/assets")
async def get_dashboard_assets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    assets_result = await db.execute(
        select(UnifiedAsset)
        .where(UnifiedAsset.user_id == current_user.id)
        .order_by(desc(UnifiedAsset.usd_value))
    )
    assets = assets_result.scalars().all()
    return assets

