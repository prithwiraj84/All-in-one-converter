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
    # Auto-delete window. Free plan / default keeps files for this long; paid
    # plans (Pro/Business) keep them longer.
    file_retention_minutes: int = 60
    paid_retention_minutes: int = 1440  # Pro / Business: 1 day
    storage_dir: str = "./storage"

    # Security
    rate_limit_per_minute: int = 60
    app_secret_key: str = "change-me-in-production"

    # Admin panel — reachable at /admin/<ADMIN_PATH_TOKEN> and gated by a
    # password. Both must be set to enable the panel; otherwise it's disabled.
    admin_path_token: str | None = None
    admin_password: str | None = None

    @property
    def admin_enabled(self) -> bool:
        return bool(self.admin_path_token and self.admin_password)

    # Hugging Face Space logs in the admin panel (container 'run' + Docker
    # 'build'). Needs a read token + the Space owner/name. Optional.
    hf_token: str | None = None
    hf_username: str | None = None
    hf_space: str | None = None

    # Concurrency / backpressure — caps simultaneous jobs so a small instance
    # can't be overwhelmed (OOM) under load. Heavy tools (documents, video, AI
    # models) get a tighter cap. Requests wait up to the timeout for a free slot,
    # then receive a clean 503 instead of piling on and crashing the box.
    max_concurrent_jobs: int = 6
    max_concurrent_heavy: int = 2
    job_queue_timeout_seconds: float = 20.0

    # External binaries
    tesseract_cmd: str = "tesseract"
    libreoffice_cmd: str = "soffice"
    ffmpeg_cmd: str = "ffmpeg"
    unar_cmd: str = "unar"  # universal archive extractor (RAR, 7z, …)

    # Optional Supabase (service role — backend only)
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

    # Transactional email (team invitations). Tries Resend, then SMTP, then
    # falls back to Supabase's invite email. All optional — invites still work
    # without email (the member gets access on sign-in), it just won't notify.
    app_url: str = "https://all-in-one-converter.devprithwiraj.in"  # frontend, for links
    email_from: str = "All in one converter <onboarding@resend.dev>"
    resend_api_key: str | None = None
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    # Email a renewal reminder this many days before a paid plan lapses.
    expiry_reminder_days: int = 3
    reminder_interval_hours: int = 12

    # ── Infrastructure (all OPTIONAL — each feature stays off until configured,
    # so the default behavior is unchanged). ──────────────────────────────────
    # Observability
    sentry_dsn: str | None = None
    sentry_traces_sample_rate: float = 0.1
    metrics_enabled: bool = True  # exposes Prometheus /metrics

    # Object storage for outputs: "local" (disk, default) or "supabase".
    storage_backend: str = "local"
    storage_bucket: str = "user-files"
    storage_signed_url_ttl: int = 86400  # signed-URL lifetime (s)

    # Result cache / content-hash dedup: "off" (default), "redis" or "supabase".
    cache_backend: str = "off"
    cache_ttl_seconds: int = 86400
    cache_cross_user: bool = False  # default per-user (privacy-safe)

    # Upstash Redis (REST) — backs the job store + cache when set.
    upstash_redis_rest_url: str | None = None
    upstash_redis_rest_token: str | None = None

    # Upstash QStash async queue. Heavy tools run async only when this is set.
    qstash_token: str | None = None
    qstash_current_signing_key: str | None = None
    qstash_next_signing_key: str | None = None
    # Public URL of THIS backend (where QStash delivers jobs); required for async.
    backend_public_url: str | None = None
    async_prefixes: str = "/api/video/,/api/ai/,/api/document/"

    @property
    def redis_enabled(self) -> bool:
        return bool(self.upstash_redis_rest_url and self.upstash_redis_rest_token)

    @property
    def qstash_enabled(self) -> bool:
        return bool(self.qstash_token and self.backend_public_url)

    @property
    def async_prefix_list(self) -> list[str]:
        return [p.strip() for p in self.async_prefixes.split(",") if p.strip()]

    # Payments (Razorpay). Amounts are in the smallest currency unit (paise for
    # INR). A successful payment grants Pro for `pro_period_days`.
    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None
    razorpay_webhook_secret: str | None = None
    razorpay_currency: str = "INR"
    razorpay_pro_amount: int = 9900       # ₹99
    razorpay_business_amount: int = 49900  # ₹499
    pro_period_days: int = 30
    business_period_days: int = 365  # Business is sold via Contact Sales → annual

    @property
    def razorpay_enabled(self) -> bool:
        return bool(self.razorpay_key_id and self.razorpay_key_secret)

    def plan_amount(self, plan: str) -> int | None:
        return {"pro": self.razorpay_pro_amount, "business": self.razorpay_business_amount}.get(plan)

    def plan_period_days(self, plan: str) -> int:
        """Validity window granted per plan activation/renewal."""
        return {"pro": self.pro_period_days, "business": self.business_period_days}.get(
            plan, self.pro_period_days
        )

    # AI tools
    # An LLM powers image captioning and (optionally) higher-quality translation.
    # Gemini (Google AI Studio) is preferred; Claude is a fallback. Without either
    # key, captioning is disabled and translation uses the free Google engine.
    # Speech-to-text model size: tiny|base|small (CPU).
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.1-flash-lite"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-3-5-sonnet-20241022"
    whisper_model: str = "base"
    # Bound Whisper's CPU threads so a transcription can't peg every core.
    whisper_cpu_threads: int = 2
    # Colorization (Photo Restore) downloads this Caffe model (~123 MB) on first
    # use. Override with a mirror if this one ever goes offline.
    colorize_model_url: str = "https://www.dropbox.com/s/dx0qvhhp5hbcx7z/colorization_release_v2.caffemodel?dl=1"

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
        patterns = [
            r"https://([a-z0-9-]+\.)*vercel\.app",
            # Production custom domain (apex + any subdomain) — allowed in every
            # environment so the live site never depends on CORS_ORIGINS being set.
            r"https://([a-z0-9-]+\.)*devprithwiraj\.in",
        ]
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
