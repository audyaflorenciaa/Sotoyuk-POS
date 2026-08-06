import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    APP_NAME: str = "F&B POS"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_PREFIX: str = "/api"

    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8

    # Fallback to SQLite for local dev so the app runs without Docker/Postgres.
    DATABASE_URL: str = "sqlite:///./kasir.db"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "kasir"
    POSTGRES_USER: str = "kasir"
    POSTGRES_PASSWORD: str = "kasir"

    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    def build_database_url(self) -> str:
        if self.DATABASE_URL.startswith("postgres"):
            return self.DATABASE_URL
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def effective_database_url(self) -> str:
        env = os.getenv("DATABASE_URL")
        if env:
            return env
        if self.DATABASE_URL.startswith("sqlite"):
            return self.DATABASE_URL
        return self.build_database_url()


@lru_cache
def get_settings() -> Settings:
    return Settings()