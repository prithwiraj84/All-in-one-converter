"""Response schemas shared across all processing endpoints."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

JobStatus = Literal["completed", "failed", "processing", "queued"]


class FileEntry(BaseModel):
    """One downloadable file (used when a tool produces several, e.g. extraction)."""

    name: str
    download_url: str
    size: int


class JobResult(BaseModel):
    """Envelope returned by every tool endpoint."""

    job_id: str = Field(..., description="Unique id for this processing job")
    tool: str = Field(..., description="Tool slug, e.g. 'merge-pdf'")
    status: JobStatus = "completed"

    # File results
    download_url: str | None = Field(None, description="Relative path to download the output")
    output_filename: str | None = None
    output_size: int | None = None
    # Multiple outputs (e.g. files extracted from an archive). download_url then
    # points to a "download all" bundle.
    files: list[FileEntry] | None = None

    # Inline text results (OCR / AI tools)
    text: str | None = None

    meta: dict[str, Any] | None = None
    error: str | None = None


class ErrorResponse(BaseModel):
    detail: str
    code: str | None = None
