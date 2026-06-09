"""Shared helpers used by every processing service."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from app.core.errors import BinaryNotFoundError, ProcessingError
from app.core.storage import public_url
from app.schemas.jobs import JobResult


def ensure_binary(cmd: str) -> str:
    """Resolve a system binary on PATH or raise a clear 503."""
    resolved = shutil.which(cmd)
    if not resolved:
        raise BinaryNotFoundError(cmd)
    return resolved


def run_command(cmd: list[str], *, timeout: int = 240, cwd: Path | None = None) -> subprocess.CompletedProcess:
    """Run an external command, raising ProcessingError on failure."""
    try:
        proc = subprocess.run(  # noqa: S603 - args are constructed internally
            cmd,
            capture_output=True,
            timeout=timeout,
            cwd=str(cwd) if cwd else None,
        )
    except FileNotFoundError as exc:
        raise BinaryNotFoundError(cmd[0]) from exc
    except subprocess.TimeoutExpired as exc:
        raise ProcessingError("Processing timed out — try a smaller file.", code="timeout", http_status=504) from exc

    if proc.returncode != 0:
        err = (proc.stderr or b"").decode("utf-8", "ignore").strip()
        raise ProcessingError(f"Conversion failed: {err[:400] or 'unknown error'}")
    return proc


def stem(filename: str) -> str:
    name = Path(filename).name
    if name.lower().endswith(".tar.gz"):
        return name[:-7]
    return Path(name).stem


def file_result(job_id: str, tool: str, output: Path, *, meta: dict | None = None) -> JobResult:
    """Build a JobResult for a downloadable file output."""
    if not output.is_file():
        raise ProcessingError("The tool did not produce an output file.")
    return JobResult(
        job_id=job_id,
        tool=tool,
        status="completed",
        download_url=public_url(job_id, output.name),
        output_filename=output.name,
        output_size=output.stat().st_size,
        meta=meta,
    )


def text_result(job_id: str, tool: str, text: str, *, meta: dict | None = None) -> JobResult:
    """Build a JobResult for an inline text output (OCR / AI)."""
    return JobResult(job_id=job_id, tool=tool, status="completed", text=text, meta=meta)
