"""Application configuration loaded from environment variables."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Server
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    environment: str = "development"

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Uploads / processing
    max_upload_mb: int = 100
    file_retention_minutes: int = 60
    storage_dir: str = "./storage"

    # Security
    rate_limit_per_minute: int = 60
    app_secret_key: str = "change-me-in-production"

    # External binaries
    tesseract_cmd: str = "tesseract"
    libreoffice_cmd: str = "soffice"
    ffmpeg_cmd: str = "ffmpeg"
    unar_cmd: str = "unar"  # universal archive extractor (RAR, 7z, …)

    # Optional Supabase (service role — backend only)
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def cors_origin_regex(self) -> str | None:
        """Extra allowed origins by pattern, complementing cors_origins_list.

        - Vercel deployments (*.vercel.app) are allowed in EVERY environment, so
          the frontend keeps working even if `ENVIRONMENT` is left unset on the
          backend host. Per-branch preview URLs are covered too. Tighten to your
          project — e.g. r"https://my-app[\\w-]*\\.vercel\\.app" — to lock down.
        - localhost / 127.0.0.1 (any port) is allowed only in development, where
          the Next.js dev server hops ports (3001/3002…) when 3000 is taken.
        """
        patterns = [r"https://([a-z0-9-]+\.)*vercel\.app"]
        if self.environment.lower() == "development":
            patterns.append(r"https?://(localhost|127\.0\.0\.1)(:\d+)?")
        return "|".join(f"(?:{p})" for p in patterns)

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def storage_path(self) -> Path:
        path = Path(self.storage_dir).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
