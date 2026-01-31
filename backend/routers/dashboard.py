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

    # 2. Check Cooldown (DISABLED FOR TESTING)
    # remaining = sync_manager.get_remaining_cooldown(current_user.id)
    # if remaining > 0:
    #     raise HTTPException(
    #         status_code=429,
    #         detail={
    #             "message": "Sync cooldown active",
    #             "retry_after": remaining
    #         }
    #     )

    # 3. Find active integrations
    result = await db.execute(
        select(Integration)
        .where(
            Integration.user_id == current_user.id,
            Integration.is_active == True
        )
    )
    integrations = result.scalars().all()
    
    if not integrations:
        raise HTTPException(status_code=404, detail="No active integration found")
        
    # 4. Trigger Sync for ALL integrations
    task_ids = []
    for integration in integrations:
        # Pass integration_id to ensure unique task dispatch
        # Note: SyncManager might need update if it enforces single-task per user logic.
        # But assuming trigger_sync just pushes to Celery, it should be fine.
        tid = sync_manager.trigger_sync(current_user.id, integration.id)
        task_ids.append(tid)
    
    # Return the first task ID so frontend has something to track.
    # Ideally frontend should handle multiple, but this suffices for "Refresh" feedback.
    return {"status": "started", "task_id": task_ids[0] if task_ids else None}

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

class HoldingItem(BaseModel):
    symbol: str
    name: str
    icon_url: Optional[str] = None
    price: float
    balance: float
    value_usd: float
    change_24h: Optional[float] = 0.0

class Movers(BaseModel):
    top_gainer: Optional[HoldingItem] = None
    top_loser: Optional[HoldingItem] = None

class DashboardSummary(BaseModel):
    net_worth: float
    daily_change: float
    allocation: List[AllocationItem]
    history: List[HistoryItem]
    holdings: List[HoldingItem]
    movers: Movers

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

    # 5. Holdings & Movers
    # We already fetched assets for allocation, but let's re-fetch or reuse.
    # Allocation query grouped by symbol/name, so it lost individual asset details if multiple entries?
    # Actually, we should query raw assets for the holdings table.
    
    # We can reuse the assets fetch if we modify the allocation query or just run a new one.
    # The allocation query used aggregate. We want detailed list.
    
    raw_assets_result = await db.execute(
        select(UnifiedAsset)
        .where(UnifiedAsset.user_id == current_user.id)
        .order_by(desc(UnifiedAsset.usd_value))
    )
    raw_assets = raw_assets_result.scalars().all()
    
    holdings_map = {}
    
    for asset in raw_assets:
        symbol = asset.symbol.upper()
        val = float(asset.usd_value or 0)
        bal = float(asset.amount or 0)
        change = float(asset.change_24h or 0)
        price = float(asset.current_price or 0)
        
        if symbol not in holdings_map:
            holdings_map[symbol] = {
                "symbol": symbol,
                "name": asset.name or symbol,
                "balance": 0.0,
                "value_usd": 0.0,
                "weighted_change_sum": 0.0,
                "price": price,
                "image_url": asset.image_url # Store image_url from first occurrence (usually fine)
            }
            
        group = holdings_map[symbol]
        group["balance"] += bal
        group["value_usd"] += val
        group["weighted_change_sum"] += (val * change)
        
        # Capture image_url if missing (e.g. from T212 entry) and this entry has it
        if not group.get("image_url") and asset.image_url:
             group["image_url"] = asset.image_url
        
        # If the group has 0 price (maybe first entry was empty), update it
        if group["price"] == 0 and price > 0:
            group["price"] = price

    holdings = []
    for sym, data in holdings_map.items():
        total_val = data["value_usd"]
        
        # Calculate weighted average change
        avg_change = 0.0
        if total_val > 0:
            avg_change = data["weighted_change_sum"] / total_val
        elif len(raw_assets) > 0:
             # Fallback if value is 0 (e.g. price missing), just take the simple average or last known?
             # If value is 0, weighting is impossible. Just take 0 or the change of the single item.
             # If we simply want to show the change, we might need a fallback. 
             # For now, 0 or simple look at data? 
             # Let's try to grab just the change from the data if only 1 item existed?
             # But simplified: if value is 0, change impact is 0.
             pass

        # Use stored image_url or fallback
        if data.get("image_url"):
            icon_url = data["image_url"]
        else:
            icon_url = f"https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/{sym.lower()}.png"
        
        holdings.append(HoldingItem(
            symbol=sym,
            name=data["name"],
            icon_url=icon_url,
            price=data["price"],
            balance=data["balance"],
            value_usd=total_val,
            change_24h=avg_change
        ))

    # Re-sort by value desc
    holdings.sort(key=lambda x: x.value_usd, reverse=True)
        
    # Movers
    # Filter only assets with value_usd > 10 to avoid dust noise? Or just > 0.
    # Let's filter > $1.00 USD
    significant_holdings = [h for h in holdings if h.value_usd > 1.0]
    # If user has only dust, just use everything
    if not significant_holdings:
        significant_holdings = holdings
        
    sorted_by_change = sorted(significant_holdings, key=lambda x: x.change_24h or 0, reverse=True)
    
    movers = Movers()
    if sorted_by_change:
        movers.top_gainer = sorted_by_change[0]
        # Only set loser if it's actually negative or different from gainer?
        # User wants "Lowest negative" or just bottom.
        # If there is only 1 asset, it is both gainer and loser? Usually UI handles that oddity.
        if len(sorted_by_change) > 1:
            movers.top_loser = sorted_by_change[-1]
        elif len(sorted_by_change) == 1:
            # If only 1 asset, maybe don't show loser if it's positive?
            # Let's just set it for now.
            # actually, if change is positive, it's gainer. if negative, it's loser.
            if (sorted_by_change[0].change_24h or 0) < 0:
                 movers.top_loser = sorted_by_change[0]
                 movers.top_gainer = None # Logic flip? No, keep simple. Top/Bottom.
            else:
                 movers.top_loser = None

    return DashboardSummary(
        net_worth=total_net_worth,
        daily_change=round(daily_change, 2),
        allocation=allocation,
        history=history,
        holdings=holdings,
        movers=movers
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

