"""All in one converter — FastAPI application entrypoint."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import settings
from app.core.errors import register_exception_handlers
from app.core.quota import enforce_quota
from app.core.security import (
    ConcurrencyLimitMiddleware,
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
)
from app.core.storage import cleanup_expired, retention_loop
from app.core import logbuffer
from app.routers import (
    admin as admin_router,
    all_routers,
    files as files_router,
    health as health_router,
    jobs as jobs_router,
    payments as payments_router,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("aio")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Startup: capture logs for the admin panel, purge stale files, run cleanup.
    logbuffer.install()
    cleanup_expired()
    task = asyncio.create_task(retention_loop())
    logger.info("All in one converter API v%s started (env=%s)", __version__, settings.environment)
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="All in one converter API",
    description="File processing API: PDF, document, image, OCR, archive, audio, video, font and AI tools.",
    version=__version__,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Middleware ─────────────────────────────────────────────────────
# Added last = outermost. CORS must wrap everything so that *every* response
# (including rate-limit 429s and error responses) carries CORS headers, and so
# the preflight short-circuit runs before the rate limiter counts the OPTIONS.
app.add_middleware(SecurityHeadersMiddleware)
# Backpressure: cap concurrent jobs so heavy load can't OOM the instance. Sits
# inside CORS/rate-limit so its 503s still carry CORS headers.
app.add_middleware(ConcurrencyLimitMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

register_exception_handlers(app)

# Health, downloads and payments stay off the processing-quota dependency.
# (Payments enforce auth via their own require_user dependency.)
_OPEN_ROUTERS = {
    id(health_router.router),
    id(files_router.router),
    id(jobs_router.router),
    id(payments_router.router),
    id(admin_router.router),
}
for router in all_routers:
    deps = [] if id(router) in _OPEN_ROUTERS else [Depends(enforce_quota)]
    app.include_router(router, dependencies=deps)


@app.get("/", tags=["health"])
def root() -> dict:
    return {
        "name": "All in one converter API",
        "version": __version__,
        "docs": "/docs",
        "health": "/api/health",
    }
