"""Health and capability checks."""
from __future__ import annotations

import shutil

from fastapi import APIRouter

from app import __version__
from app.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
@router.get("/api/health")
def health() -> dict:
    """Liveness probe + which optional binaries are available."""
    return {
        "status": "ok",
        "version": __version__,
        "environment": settings.environment,
        "capabilities": {
            "ffmpeg": shutil.which(settings.ffmpeg_cmd) is not None,
            "tesseract": shutil.which(settings.tesseract_cmd) is not None,
            "libreoffice": shutil.which(settings.libreoffice_cmd) is not None,
        },
    }
