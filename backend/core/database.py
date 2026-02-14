"""Database core configuration — Async engine and session management.

This module provides loop-aware engines for Celery workers and general path
access to the database via SQLAlchemy.
"""

import asyncio
import os

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, AsyncEngine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/quantpulse")

# Global variables for caching the engine and sessionmaker
_engine_cache = {}


def get_async_engine() -> AsyncEngine:
    """Creates and returns an AsyncEngine instance specific to the current event loop.

    This prevents "Future attached to a different loop" errors in Task Queues.
    """
    loop = asyncio.get_event_loop()
    if loop not in _engine_cache:
        _engine_cache[loop] = create_async_engine(
            DATABASE_URL,
            echo=False,
            pool_size=20,
            max_overflow=10,
            pool_pre_ping=True,
            pool_recycle=3600,
        )
    return _engine_cache[loop]


def get_async_sessionmaker() -> sessionmaker:
    """Returns a session factory for the current event loop's engine."""
    engine = get_async_engine()
    # Note: sessionmaker can be shared, but it must point to the loop-correct engine
    return sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def dispose_loop_engine():
    """Explicitly disposes the engine for the current loop and cleans up cache."""
    loop = asyncio.get_event_loop()
    if loop in _engine_cache:
        engine = _engine_cache.pop(loop)
        await engine.dispose()


Base = declarative_base()


async def get_db():
    """Dependency for providing a database session in FastAPI endpoints."""
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        yield session
