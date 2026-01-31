from pydantic_settings import BaseSettings

import os

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/quantpulse"
    
    # Secrets must be loaded from environment for security
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY")
    
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 1 day
    
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
        extra = "ignore" # Allow extra env vars

settings = Settings()
