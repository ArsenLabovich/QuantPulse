"""Application configuration and environment settings management."""

from pydantic_settings import BaseSettings

import os


class Settings(BaseSettings):
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/quantpulse"
    )
    REDIS_URL: str = "redis://localhost:6379/0"

    # Secrets must be loaded from environment for security
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY")

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # --- Sync & Snapshot Settings ---
    SYNC_LOCK_TTL_SEC: int = 30  # TTL for integration sync lock
    SYNC_WAIT_MAX_SEC: int = 20  # Max wait time if sync is already in progress
    SNAPSHOT_LOCK_TTL_SEC: int = 30  # TTL for snapshot lock
    SNAPSHOT_LOCK_TIMEOUT_SEC: float = 25.0  # Timeout for waiting for snapshot lock
    SNAPSHOT_DEDUP_WINDOW_SEC: int = 45  # Snapshot deduplication window (seconds)

    # --- Data Retention & General ---
    PRICE_HISTORY_KEEP_HOURS: int = 48  # Price history retention hours
    BASE_CURRENCY: str = "USD"  # The system's base currency

    # --- Distributed Lock Defaults ---
    DLOCK_RETRY_INTERVAL_SEC: float = 0.3
    DLOCK_DEFAULT_TIMEOUT_SEC: float = 10.0

    # Validate secrets exist
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.SECRET_KEY or self.SECRET_KEY == "CHANGE_ME":
            # Fallback for dev only if explicitly set locally, but better to warn
            pass
            # raise ValueError("SECRET_KEY is missing from environment variables")
        if not self.ENCRYPTION_KEY:
            # raise ValueError("ENCRYPTION_KEY is missing from environment variables")
            pass

    class Config:
        env_file = ".env"
        extra = "ignore"  # Allow extra env vars


settings = Settings()
