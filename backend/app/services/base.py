"""Shared helpers used by every processing service."""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

from app.config import settings
from app.core import progress
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


def _ffprobe_bin() -> str | None:
    """Resolve ffprobe (ships with ffmpeg) from the configured ffmpeg path."""
    candidate = settings.ffmpeg_cmd.replace("ffmpeg", "ffprobe")
    return shutil.which(candidate) or shutil.which("ffprobe")


def ffprobe_duration(src: Path) -> float | None:
    """Media duration in seconds via ffprobe, or None if undeterminable."""
    ffprobe = _ffprobe_bin()
    if not ffprobe:
        return None
    try:
        proc = subprocess.run(  # noqa: S603 - args constructed internally
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(src)],
            capture_output=True, timeout=30,
        )
        seconds = float((proc.stdout or b"").decode("utf-8", "ignore").strip())
        return seconds if seconds > 0 else None
    except (ValueError, subprocess.SubprocessError, OSError):
        return None


def _report_from_progress_file(path: str, duration: float, stage: str) -> None:
    """Parse the latest out_time from ffmpeg's -progress file and report %."""
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as fh:
            data = fh.read()
    except OSError:
        return
    last: str | None = None
    for line in data.splitlines():
        if line.startswith("out_time_us="):
            last = line.split("=", 1)[1].strip()
    if not last or last == "N/A":
        return
    try:
        seconds = float(last) / 1_000_000.0
    except ValueError:
        return
    progress.report(seconds / duration * 100.0, stage)


def run_ffmpeg(cmd: list[str], src: Path, *, timeout: int = 600, stage: str = "encoding") -> None:
    """Run an ffmpeg command, streaming real progress when the input duration is
    known. Falls back to a plain blocking run when progress can't be tracked
    (no ffprobe / unknown duration). Raises ProcessingError on failure/timeout.

    To avoid pipe-buffer deadlocks we send progress to its own temp file and
    stderr to another temp file (regular files never block), poll the progress
    file every 0.5s, and enforce an overall deadline.
    """
    duration = ffprobe_duration(src)
    if not duration:
        run_command(cmd, timeout=timeout)
        return

    fd, progress_file = tempfile.mkstemp(suffix=".ffprogress")
    os.close(fd)
    err_file = tempfile.TemporaryFile()
    pcmd = [cmd[0], "-progress", progress_file, "-nostats", *cmd[1:]]
    try:
        try:
            proc = subprocess.Popen(  # noqa: S603 - args constructed internally
                pcmd, stdout=subprocess.DEVNULL, stderr=err_file,
            )
        except FileNotFoundError as exc:
            raise BinaryNotFoundError(cmd[0]) from exc

        deadline = time.monotonic() + timeout
        try:
            while proc.poll() is None:
                if time.monotonic() > deadline:
                    proc.kill()
                    raise ProcessingError(
                        "Processing timed out — try a smaller file.", code="timeout", http_status=504
                    )
                _report_from_progress_file(progress_file, duration, stage)
                time.sleep(0.5)
            _report_from_progress_file(progress_file, duration, stage)
        finally:
            if proc.poll() is None:
                proc.kill()

        if proc.returncode != 0:
            err_file.seek(0)
            err = err_file.read().decode("utf-8", "ignore").strip()
            raise ProcessingError(f"Conversion failed: {err[-400:] or 'unknown error'}")
        progress.report(99.0, stage)
    finally:
        err_file.close()
        try:
            os.unlink(progress_file)
        except OSError:
            pass


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
