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
        from prometheus_fastapi_instrumentator import Instrumentator, metrics

        instrumentator = Instrumentator(
            should_group_status_codes=True,
            excluded_handlers=["/metrics", "/api/health"],
        )
        # default() = latency + size histograms (handler/method labels, no status).
        # Add requests() so we also get http_requests_total{handler,method,status}
        # — that's where the status-code breakdown / error rate comes from.
        instrumentator.add(metrics.default())
        instrumentator.add(metrics.requests())
        instrumentator.instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
        logger.info("Prometheus /metrics enabled")
    except Exception:  # noqa: BLE001
        logger.warning("metrics init failed (prometheus instrumentator missing?)", exc_info=True)


# ── Admin-panel snapshot (read-only status for the Observability tab) ──────────
def sentry_status() -> dict:
    """Sentry config + whether the SDK is actually active. The DSN's public key
    is masked (host + project id are not secret)."""
    dsn = settings.sentry_dsn or ""
    masked: str | None = None
    if dsn:
        try:
            from urllib.parse import urlparse

            u = urlparse(dsn)
            masked = f"{u.scheme}://***@{u.hostname or '?'}{u.path}"
        except Exception:  # noqa: BLE001
            masked = "configured"
    active = False
    if dsn:
        try:
            import sentry_sdk

            client = sentry_sdk.get_client()
            active = bool(getattr(client, "is_active", lambda: False)())
        except Exception:  # noqa: BLE001
            active = False
    return {
        "enabled": bool(dsn),
        "active": active,
        "dsn_masked": masked,
        "environment": settings.environment,
        "traces_sample_rate": settings.sentry_traces_sample_rate,
    }


def metrics_summary() -> dict:
    """Aggregate the in-process Prometheus registry into a readable summary
    (total requests, status breakdown, per-endpoint counts + average latency).
    No-op-friendly: returns a reason when metrics are off or the package is
    missing (e.g. local dev), and `available: false` before any request lands."""
    if not settings.metrics_enabled:
        return {"enabled": False, "reason": "METRICS_ENABLED is off."}
    try:
        from prometheus_client import REGISTRY
    except Exception:  # noqa: BLE001
        return {"enabled": False, "reason": "Metrics package not installed (it installs on the deployed backend)."}

    total = 0.0
    by_status: dict[str, float] = {}
    ep_count: dict[str, float] = {}      # request count per endpoint (incl. status)
    ep_dur_sum: dict[str, float] = {}    # summed latency per endpoint (histogram)
    ep_dur_count: dict[str, float] = {}  # latency observations per endpoint
    found = False
    have_requests = False

    def _family(code) -> str:
        # Normalize to a status family so we're robust whether the instrumentator
        # reports raw codes ("200") or grouped ones ("2xx").
        c = str(code)
        return (c[0] + "xx") if c[:1].isdigit() else c

    try:
        families = list(REGISTRY.collect())

        # Status + per-endpoint counts come from the requests counter, which (unlike
        # the default duration histogram) carries a `status` label. NOTE: a
        # prometheus_client Counter's family name drops the `_total` suffix, so the
        # family is "http_requests" while its value samples are "http_requests_total".
        reqs = next((f for f in families if f.name == "http_requests"), None)
        if reqs is not None:
            have_requests = found = True
            for s in reqs.samples:
                if s.name != "http_requests_total":  # skip _created
                    continue
                handler = s.labels.get("handler", "?")
                code = _family(s.labels.get("status") or s.labels.get("status_code") or "?")
                total += s.value
                by_status[code] = by_status.get(code, 0.0) + s.value
                ep_count[handler] = ep_count.get(handler, 0.0) + s.value

        # Latency from the per-endpoint duration histogram (handler label, no status).
        dur = next((f for f in families if f.name == "http_request_duration_seconds"), None)
        if dur is None:
            dur = next(
                (f for f in families
                 if f.name.endswith("request_duration_seconds")
                 and any("handler" in s.labels for s in f.samples)),
                None,
            )
        if dur is not None:
            found = True
            for s in dur.samples:
                handler = s.labels.get("handler", "?")
                if s.name.endswith("_count"):
                    ep_dur_count[handler] = ep_dur_count.get(handler, 0.0) + s.value
                elif s.name.endswith("_sum"):
                    ep_dur_sum[handler] = ep_dur_sum.get(handler, 0.0) + s.value

        # Fallback: if the requests counter isn't present, derive totals + endpoint
        # counts from the histogram (no status breakdown then, but counts still work).
        if not have_requests and dur is not None:
            for h, c in ep_dur_count.items():
                ep_count[h] = ep_count.get(h, 0.0) + c
                total += c
    except Exception:  # noqa: BLE001
        logger.warning("metrics summary parse failed", exc_info=True)

    top = sorted(ep_count.items(), key=lambda kv: kv[1], reverse=True)[:12]
    endpoints = []
    for h, c in top:
        dc = ep_dur_count.get(h, 0.0)
        endpoints.append({
            "handler": h, "count": int(c),
            "avg_ms": round((ep_dur_sum.get(h, 0.0) / dc) * 1000, 1) if dc else 0.0,
        })
    errors = sum(v for k, v in by_status.items() if k.startswith("4") or k.startswith("5"))
    return {
        "enabled": True,
        "available": found and total > 0,
        "endpoint": "/metrics",
        "total_requests": int(total),
        "by_status": {k: int(v) for k, v in sorted(by_status.items())},
        "error_rate": round((errors / total) * 100, 1) if total else 0.0,
        "endpoints": endpoints,
    }


def admin_snapshot() -> dict:
    """Combined Sentry + metrics view for the admin panel's Observability tab."""
    return {"sentry": sentry_status(), "metrics": metrics_summary()}
