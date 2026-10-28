f"""Application settings loaded from environment variables.

Keeping configuration in one place makes local development and deployment easier:
values can change without editing Python source code.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed application configuration.

    Pydantic reads matching values from the operating-system environment first,
    then from either supported .env location. Environment variables are not
    case-sensitive, so DATABASE_URL and database_url both work.
    """

    app_name: str = "University Past Paper Repository API"
    environment: str = "development"
    database_url: str = (
        "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/past_papers"
    )
    
    # Supabase credentials mapped from .env
    supabase_url: str = ""
    supabase_key: str = ""
    gemini_api_key: str = ""

    # Community moderation: number of reports before a paper is auto-deleted
    report_threshold: int = 5

    allowed_origins: str = (
        "http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500,"
        "http://localhost:8000,http://127.0.0.1:8000"
    )
    upload_dir: Path = Path(__file__).resolve().parent.parent / "uploads"
    max_upload_size_mb: int = 15
    # Optional absolute backend URL, for example https://api.example.com.
    # Leave blank when the API and frontend are served from the same origin.
    public_base_url: str = ""

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        """Make common cloud PostgreSQL URLs explicitly use Psycopg 3."""

        if not isinstance(value, str):
            return value
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @property
    def cors_origins(self) -> list[str]:
        """Turn the comma-separated ALLOWED_ORIGINS value into a clean list."""

        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Build settings once, then reuse the same immutable-style object."""

    return Settings()


settings = get_settings()
