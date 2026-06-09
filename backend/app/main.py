"""All in one convertor — FastAPI application entrypoint."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import settings
from app.core.errors import register_exception_handlers
from app.core.security import RateLimitMiddleware, SecurityHeadersMiddleware
from app.core.storage import cleanup_expired, retention_loop
from app.routers import all_routers

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("aio")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Startup: purge anything stale, then run periodic cleanup.
    cleanup_expired()
    task = asyncio.create_task(retention_loop())
    logger.info("All in one convertor API v%s started (env=%s)", __version__, settings.environment)
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="All in one convertor API",
    description="File processing API: PDF, document, image, OCR, archive, audio, video, font and AI tools.",
    version=__version__,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Middleware (executes bottom-up) ────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

register_exception_handlers(app)

for router in all_routers:
    app.include_router(router)


@app.get("/", tags=["health"])
def root() -> dict:
    return {
        "name": "All in one convertor API",
        "version": __version__,
        "docs": "/docs",
        "health": "/api/health",
    }
