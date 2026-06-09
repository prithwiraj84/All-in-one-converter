"""Archive tools: extract and convert ZIP / TAR / TAR.GZ (stdlib only)."""
from __future__ import annotations

import tarfile
import zipfile
from pathlib import Path

from app.core.errors import ProcessingError
from app.schemas.jobs import JobResult
from app.services.base import file_result, stem


def _safe_within(base: Path, target: Path) -> bool:
    try:
        target.resolve().relative_to(base.resolve())
        return True
    except ValueError:
        return False


def _extract(src: Path, dest: Path) -> list[str]:
    """Safely extract an archive, guarding against path traversal."""
    dest.mkdir(parents=True, exist_ok=True)
    names: list[str] = []

    if zipfile.is_zipfile(src):
        with zipfile.ZipFile(src) as zf:
            for member in zf.namelist():
                out_path = dest / member
                if not _safe_within(dest, out_path):
                    raise ProcessingError("Archive contains unsafe paths and was rejected.")
            zf.extractall(dest)
            names = zf.namelist()
    elif tarfile.is_tarfile(src):
        with tarfile.open(src) as tf:
            for member in tf.getmembers():
                out_path = dest / member.name
                if not _safe_within(dest, out_path):
                    raise ProcessingError("Archive contains unsafe paths and was rejected.")
            tf.extractall(dest)
            names = tf.getnames()
    else:
        raise ProcessingError("Unsupported archive format. Use ZIP, TAR or TAR.GZ.")

    return [n for n in names if n and not n.endswith("/")]


def _repackage(folder: Path, out: Path, fmt: str) -> None:
    files = [p for p in folder.rglob("*") if p.is_file()]
    if fmt == "zip":
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
            for p in files:
                zf.write(p, arcname=str(p.relative_to(folder)))
    elif fmt in ("tar", "tar.gz"):
        mode = "w:gz" if fmt == "tar.gz" else "w"
        with tarfile.open(out, mode) as tf:
            for p in files:
                tf.add(p, arcname=str(p.relative_to(folder)))
    else:
        raise ProcessingError(f"Unsupported target format '{fmt}'.")


def extract(job_id: str, src: Path, out_dir: Path) -> JobResult:
    work = out_dir / "_extracted"
    entries = _extract(src, work)
    out = out_dir / f"{stem(src.name)}-extracted.zip"
    _repackage(work, out, "zip")
    return file_result(
        job_id,
        "zip-extractor",
        out,
        meta={"entry_count": len(entries), "entries": entries[:50]},
    )


def convert(job_id: str, src: Path, out_dir: Path, *, target: str = "zip") -> JobResult:
    target = target.lower()
    if target not in ("zip", "tar", "tar.gz"):
        raise ProcessingError(f"Unsupported target format '{target}'.")
    work = out_dir / "_work"
    _extract(src, work)
    ext = ".tar.gz" if target == "tar.gz" else f".{target}"
    out = out_dir / f"{stem(src.name)}{ext}"
    _repackage(work, out, target)
    return file_result(job_id, "archive-converter", out, meta={"format": target})
