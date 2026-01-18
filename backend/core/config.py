from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/quantpulse"
    SECRET_KEY: str = "YOUR_SUPER_SECRET_KEY_CHANGE_ME"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 1 day
    ENCRYPTION_KEY: str = "JdCyz-870sL_9YtX8J5aC_P3yV1a505f0_uA3b505f0="  # Default dev key (Fernet valid)

    class Config:
        env_file = ".env"

settings = Settings()
