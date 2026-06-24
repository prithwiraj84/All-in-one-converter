"""Observability — Sentry error tracking (no-op without SENTRY_DSN).

Sentry and the metrics instrumentator are imported lazily so the app boots even
if the packages aren't installed. Everything is a graceful no-op when unconfigured.
"""
from __future__ import annotations

import logging

from app.config import settings

logger = logging.getLogger("aio.obs")


def init_sentry() -> bool:
    """Initialize Sentry if SENTRY_DSN is set. Returns True if active."""
    if not settings.sentry_dsn:
        return False
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            traces_sample_rate=settings.sentry_traces_sample_rate,
            send_default_pii=False,
            integrations=[StarletteIntegration(), FastApiIntegration()],
        )
        logger.info("Sentry initialized (env=%s)", settings.environment)
        return True
    except Exception:  # noqa: BLE001 - never let observability break boot
        logger.warning("Sentry init failed", exc_info=True)
        return False


def capture(exc: BaseException, **tags: str) -> None:
    """Report an exception to Sentry (no-op when unconfigured)."""
    if not settings.sentry_dsn:
        return
    try:
        import sentry_sdk

        if tags:
            with sentry_sdk.push_scope() as scope:
                for k, v in tags.items():
                    scope.set_tag(k, v)
                sentry_sdk.capture_exception(exc)
        else:
            sentry_sdk.capture_exception(exc)
    except Exception:  # noqa: BLE001
        pass


def install_metrics(app) -> None:
    """Expose Prometheus metrics at /metrics (no-op if disabled/unavailable)."""
    if not settings.metrics_enabled:
        return
    try:
        from prometheus_fastapi_instrumentator import Instrumentator

        Instrumentator(
            should_group_status_codes=True,
            excluded_handlers=["/metrics", "/api/health"],
        ).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
        logger.info("Prometheus /metrics enabled")
    except Exception:  # noqa: BLE001
        logger.warning("metrics init failed (prometheus instrumentator missing?)", exc_info=True)
