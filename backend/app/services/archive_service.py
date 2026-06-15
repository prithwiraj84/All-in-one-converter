"""Archive tools: extract and convert ZIP / TAR / TAR.GZ / RAR / 7z.

ZIP and TAR family are handled with the stdlib. RAR, 7z and other formats fall
back to the `unar` universal extractor (installed in the Docker image).
"""
from __future__ import annotations

import shutil
import tarfile
import zipfile
from pathlib import Path

from app.config import settings
from app.core.errors import ProcessingError
from app.core.storage import public_url
from app.schemas.jobs import FileEntry, JobResult
from app.services.base import ensure_binary, file_result, run_command, stem


def _safe_within(base: Path, target: Path) -> bool:
    try:
        target.resolve().relative_to(base.resolve())
        return True
    except ValueError:
        return False


def _extract_with_unar(src: Path, dest: Path) -> None:
    """Extract any format `unar` understands (RAR, 7z, …) into dest."""
    unar = ensure_binary(settings.unar_cmd)
    # -q quiet, -D no enclosing folder, -f overwrite, -o output dir.
    run_command([unar, "-q", "-D", "-f", "-o", str(dest), str(src)])


def _extract(src: Path, dest: Path) -> list[str]:
    """Safely extract an archive, guarding against path traversal."""
    dest.mkdir(parents=True, exist_ok=True)

    if zipfile.is_zipfile(src):
        with zipfile.ZipFile(src) as zf:
            for member in zf.namelist():
                if not _safe_within(dest, dest / member):
                    raise ProcessingError("Archive contains unsafe paths and was rejected.")
            zf.extractall(dest)
    elif tarfile.is_tarfile(src):
        with tarfile.open(src) as tf:
            for member in tf.getmembers():
                if not _safe_within(dest, dest / member.name):
                    raise ProcessingError("Archive contains unsafe paths and was rejected.")
            tf.extractall(dest)
    else:
        # RAR, 7z and friends — delegate to the universal extractor.
        _extract_with_unar(src, dest)
        for p in dest.rglob("*"):
            if not _safe_within(dest, p):
                raise ProcessingError("Archive contains unsafe paths and was rejected.")

    # Collect the actual files that landed on disk (works for every backend).
    return sorted(
        str(p.relative_to(dest)) for p in dest.rglob("*") if p.is_file()
    )


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
    """Extract an archive and return its contents.

    - A single inner file is returned directly.
    - Multiple files are each made individually downloadable (so users get the
      actual files, not another archive), plus a "download all" ZIP bundle.
    """
    work = out_dir / "_extracted"
    _extract(src, work)
    files = sorted(p for p in work.rglob("*") if p.is_file())

    if not files:
        raise ProcessingError("The archive is empty — there's nothing to extract.")

    if len(files) == 1:
        only = files[0]
        out = out_dir / only.name
        if out.resolve() != only.resolve():
            shutil.move(str(only), str(out))
        return file_result(job_id, "zip-extractor", out, meta={"entry_count": 1})

    # Flatten each extracted file into the job dir so it's individually
    # downloadable (the download route serves files by basename).
    used: set[str] = set()
    entries: list[FileEntry] = []
    for p in files:
        rel = str(p.relative_to(work)).replace("\\", "/")
        flat = rel.replace("/", "_")
        candidate, i = flat, 1
        while candidate in used:
            fp = Path(flat)
            candidate = f"{fp.stem}_{i}{fp.suffix}"
            i += 1
        used.add(candidate)
        target = out_dir / candidate
        shutil.copy2(p, target)
        entries.append(
            FileEntry(name=rel, download_url=public_url(job_id, candidate), size=target.stat().st_size)
        )

    # Plus a single "download all" ZIP.
    bundle = out_dir / f"{stem(src.name)}-extracted.zip"
    _repackage(work, bundle, "zip")
    return JobResult(
        job_id=job_id,
        tool="zip-extractor",
        status="completed",
        download_url=public_url(job_id, bundle.name),
        output_filename=bundle.name,
        output_size=bundle.stat().st_size,
        files=entries,
        meta={"entry_count": len(entries)},
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
