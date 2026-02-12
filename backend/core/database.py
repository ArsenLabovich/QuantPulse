from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/quantpulse")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=20,          # Базовый пул соединений
    max_overflow=10,       # Дополнительные соединения при нагрузке
    pool_pre_ping=True,    # Проверка соединения перед использованием
    pool_recycle=3600      # Переоткрытие соединений каждый час
)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
