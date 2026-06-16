"""Security middleware and upload validation."""
from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque

from fastapi import HTTPException, UploadFile, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds a baseline of hardening headers to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory per-IP sliding-window rate limiter.

    For multi-instance deployments swap the backing store for Redis.
    """

    def __init__(self, app, limit_per_minute: int | None = None):
        super().__init__(app)
        self.limit = limit_per_minute or settings.rate_limit_per_minute
        self.window = 60.0
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _client(self, request: Request) -> str:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
        return request.client.host if request.client else "anonymous"

    async def dispatch(self, request: Request, call_next) -> Response:
        # Only throttle the processing API, not health/docs/downloads.
        path = request.url.path
        if not path.startswith("/api/") or path.startswith("/api/files/download"):
            return await call_next(request)

        now = time.time()
        key = self._client(request)
        hits = self._hits[key]
        while hits and hits[0] <= now - self.window:
            hits.popleft()

        if len(hits) >= self.limit:
            retry = int(self.window - (now - hits[0])) + 1
            return Response(
                content=f'{{"detail":"Rate limit exceeded. Try again in {retry}s.","code":"rate_limited"}}',
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                media_type="application/json",
                headers={"Retry-After": str(retry)},
            )

        hits.append(now)
        return await call_next(request)


class ConcurrencyLimitMiddleware(BaseHTTPMiddleware):
    """Caps concurrent processing jobs so a small instance can't be OOM-crashed.

    A global semaphore bounds *all* processing jobs; a tighter one bounds the
    heavy tools (documents, video, AI models). A request waits up to
    `job_queue_timeout_seconds` for a free slot, then gets a clean 503 (with
    Retry-After) instead of piling on and taking the whole container down.

    Per-instance (in-memory) — correct for the single-container deployment. For
    a multi-instance setup, move this to a shared limiter (e.g. Redis).
    """

    HEAVY_PREFIXES = ("/api/document/", "/api/video/", "/api/ai/")

    def __init__(self, app):
        super().__init__(app)
        self._total = asyncio.Semaphore(max(1, settings.max_concurrent_jobs))
        self._heavy = asyncio.Semaphore(max(1, settings.max_concurrent_heavy))
        self._timeout = max(1.0, settings.job_queue_timeout_seconds)

    async def _acquire(self, sem: asyncio.Semaphore) -> bool:
        try:
            await asyncio.wait_for(sem.acquire(), timeout=self._timeout)
            return True
        except asyncio.TimeoutError:
            return False

    @staticmethod
    def _busy() -> Response:
        return Response(
            content='{"detail":"The server is busy right now — please try again in a few seconds.","code":"server_busy"}',
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            media_type="application/json",
            headers={"Retry-After": "5"},
        )

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        # Only throttle the actual processing endpoints (POST under /api, minus
        # the open health/download routes). Everything else passes straight
        # through so the UI, auth and downloads stay responsive under load.
        if (
            request.method != "POST"
            or not path.startswith("/api/")
            or path.startswith("/api/files")
            or path.startswith("/api/payments")
        ):
            return await call_next(request)

        heavy = path.startswith(self.HEAVY_PREFIXES)
        if not await self._acquire(self._total):
            return self._busy()
        if heavy and not await self._acquire(self._heavy):
            self._total.release()
            return self._busy()
        try:
            return await call_next(request)
        finally:
            if heavy:
                self._heavy.release()
            self._total.release()


# ── Upload validation ──────────────────────────────────────────────

# A conservative allow-list of extensions the platform accepts.
ALLOWED_EXTENSIONS = {
    # documents
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf", ".odt",
    # images
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif", ".heic",
    # audio
    ".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a",
    # video
    ".mp4", ".webm", ".mov", ".avi", ".mkv",
    # archives
    ".zip", ".tar", ".gz", ".tgz", ".rar", ".7z",
    # fonts
    ".ttf", ".otf", ".woff", ".woff2",
}


def _ext(filename: str) -> str:
    name = filename.lower()
    if name.endswith(".tar.gz"):
        return ".gz"
    dot = name.rfind(".")
    return name[dot:] if dot != -1 else ""


def validate_upload(file: UploadFile, *, allowed_exts: set[str] | None = None) -> None:
    """Validate a single upload's extension and (best-effort) size."""
    if not file.filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing filename.")

    ext = _ext(file.filename)
    permitted = allowed_exts or ALLOWED_EXTENSIONS
    if ext not in permitted:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"File type '{ext or 'unknown'}' is not supported for this tool.",
        )

    # Size check when the stream exposes a size (Starlette populates this).
    size = getattr(file, "size", None)
    if size is not None and size > settings.max_upload_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"File exceeds the {settings.max_upload_mb} MB limit.",
        )


def scan_for_malware(path) -> bool:
    """Malware-scan placeholder.

    Wire this to ClamAV / VirusTotal / an antivirus sidecar in production.
    Returns True when the file is considered clean.
    """
    return True
