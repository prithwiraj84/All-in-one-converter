"""Custom exceptions and FastAPI exception handlers."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger("aio.errors")


class ProcessingError(Exception):
    """Raised by services when a file cannot be processed."""

    def __init__(self, message: str, code: str = "processing_error", http_status: int = 422):
        super().__init__(message)
        self.message = message
        self.code = code
        self.http_status = http_status


class BinaryNotFoundError(ProcessingError):
    """Raised when a required system binary (ffmpeg, tesseract, soffice) is missing."""

    def __init__(self, binary: str):
        super().__init__(
            f"Required tool '{binary}' is not installed on the server.",
            code="binary_not_found",
            http_status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ProcessingError)
    async def _processing_error(_: Request, exc: ProcessingError) -> JSONResponse:
        logger.warning("ProcessingError: %s", exc.message)
        return JSONResponse(
            status_code=exc.http_status,
            content={"detail": exc.message, "code": exc.code},
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An unexpected error occurred while processing your file.", "code": "internal_error"},
        )
