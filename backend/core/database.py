from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/quantpulse")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=20,          # Base connection pool size
    max_overflow=10,       # Extra connections during peak loads
    pool_pre_ping=True,    # Check connection validity before use
    pool_recycle=3600      # Recycle connections every hour
)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
