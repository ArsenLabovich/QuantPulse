import asyncio
import os
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from models.assets import UnifiedAsset
from models.user import User

# Hardcoded DB URL from docker-compose or defaults
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/quantpulse")

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        # Fetch all assets
        result = await session.execute(
            select(UnifiedAsset).order_by(desc(UnifiedAsset.usd_value))
        )
        assets = result.scalars().all()
        
        print(f"{'SYMBOL':<10} {'AMOUNT':<20} {'USD VALUE':<20} {'SOURCE':<20}")
        print("-" * 70)
        for asset in assets:
            print(f"{asset.symbol:<10} {asset.amount:<20.8f} ${asset.usd_value:<19.2f} {asset.original_name}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
