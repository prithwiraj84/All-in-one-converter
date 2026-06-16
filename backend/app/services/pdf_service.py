"""PDF processing: merge, split, compress, rotate, protect, unlock, numbers, watermark."""
from __future__ import annotations

import zipfile
from pathlib import Path

import fitz  # PyMuPDF
from pypdf import PdfReader, PdfWriter

from app.core.errors import ProcessingError
from app.schemas.jobs import JobResult
from app.services.base import file_result, stem

TOOL_MERGE = "merge-pdf"


def merge(job_id: str, inputs: list[Path], out_dir: Path) -> JobResult:
    if len(inputs) < 2:
        raise ProcessingError("Please upload at least two PDF files to merge.")
    writer = PdfWriter()
    for path in inputs:
        try:
            reader = PdfReader(str(path))
        except Exception as exc:  # noqa: BLE001
            raise ProcessingError(f"Could not read '{path.name}'. Is it a valid PDF?") from exc
        if reader.is_encrypted:
            raise ProcessingError(f"'{path.name}' is password-protected. Unlock it first.")
        for page in reader.pages:
            writer.add_page(page)
    out = out_dir / "merged.pdf"
    with out.open("wb") as f:
        writer.write(f)
    return file_result(job_id, "merge-pdf", out, meta={"merged_files": len(inputs)})


def _parse_ranges(spec: str, page_count: int) -> list[int]:
    """Parse '1-3, 5, 8-10' into a sorted list of 0-based page indices."""
    pages: set[int] = set()
    for chunk in spec.replace(" ", "").split(","):
        if not chunk:
            continue
        if "-" in chunk:
            a, _, b = chunk.partition("-")
            start, end = int(a), int(b)
            for p in range(start, end + 1):
                if 1 <= p <= page_count:
                    pages.add(p - 1)
        else:
            p = int(chunk)
            if 1 <= p <= page_count:
                pages.add(p - 1)
    if not pages:
        raise ProcessingError("No valid pages in the given range.")
    return sorted(pages)


def split(job_id: str, src: Path, out_dir: Path, *, ranges: str = "") -> JobResult:
    try:
        reader = PdfReader(str(src))
    except Exception as exc:  # noqa: BLE001
        raise ProcessingError("Could not read the PDF.") from exc
    count = len(reader.pages)
    base = stem(src.name)

    if ranges.strip():
        indices = _parse_ranges(ranges, count)
        writer = PdfWriter()
        for i in indices:
            writer.add_page(reader.pages[i])
        out = out_dir / f"{base}-pages.pdf"
        with out.open("wb") as f:
            writer.write(f)
        return file_result(job_id, "split-pdf", out, meta={"pages": [i + 1 for i in indices]})

    # No ranges → one PDF per page, zipped.
    out = out_dir / f"{base}-split.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for i in range(count):
            writer = PdfWriter()
            writer.add_page(reader.pages[i])
            page_path = out_dir / f"{base}-page-{i + 1}.pdf"
            with page_path.open("wb") as f:
                writer.write(f)
            zf.write(page_path, arcname=f"{base}-page-{i + 1}.pdf")
            page_path.unlink(missing_ok=True)
    return file_result(job_id, "split-pdf", out, meta={"page_count": count})


def compress(job_id: str, src: Path, out_dir: Path, *, level: str = "recommended") -> JobResult:
    doc = fitz.open(str(src))
    out = out_dir / f"{stem(src.name)}-compressed.pdf"
    # Garbage-collect, deflate streams; aggressive options for "extreme".
    deflate_images = level in ("recommended", "extreme")
    doc.save(
        str(out),
        garbage=4,
        deflate=True,
        deflate_images=deflate_images,
        deflate_fonts=True,
        clean=True,
    )
    doc.close()
    before = src.stat().st_size
    after = out.stat().st_size
    saved = max(0, round((1 - after / before) * 100)) if before else 0
    return file_result(job_id, "compress-pdf", out, meta={"reduced_percent": saved, "level": level})


def rotate(job_id: str, src: Path, out_dir: Path, *, angle: int = 90) -> JobResult:
    angle = int(angle) % 360
    reader = PdfReader(str(src))
    writer = PdfWriter()
    for page in reader.pages:
        page.rotate(angle)
        writer.add_page(page)
    out = out_dir / f"{stem(src.name)}-rotated.pdf"
    with out.open("wb") as f:
        writer.write(f)
    return file_result(job_id, "rotate-pdf", out, meta={"angle": angle})


def protect(job_id: str, src: Path, out_dir: Path, *, password: str) -> JobResult:
    if not password:
        raise ProcessingError("A password is required to protect the PDF.")
    reader = PdfReader(str(src))
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    writer.encrypt(password, algorithm="AES-256")
    out = out_dir / f"{stem(src.name)}-protected.pdf"
    with out.open("wb") as f:
        writer.write(f)
    return file_result(job_id, "protect-pdf", out)


def unlock(job_id: str, src: Path, out_dir: Path, *, password: str = "") -> JobResult:
    reader = PdfReader(str(src))
    if reader.is_encrypted:
        if reader.decrypt(password) == 0:
            raise ProcessingError("Incorrect password — could not unlock the PDF.", code="bad_password")
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    out = out_dir / f"{stem(src.name)}-unlocked.pdf"
    with out.open("wb") as f:
        writer.write(f)
    return file_result(job_id, "unlock-pdf", out)


_POSITIONS = {
    "bottom-center": (0.5, 0.96, "center"),
    "bottom-right": (0.92, 0.96, "right"),
    "bottom-left": (0.08, 0.96, "left"),
    "top-center": (0.5, 0.05, "center"),
    "top-right": (0.92, 0.05, "right"),
}


def page_numbers(job_id: str, src: Path, out_dir: Path, *, position: str = "bottom-center", start: int = 1) -> JobResult:
    doc = fitz.open(str(src))
    fx, fy, _ = _POSITIONS.get(position, _POSITIONS["bottom-center"])
    for idx, page in enumerate(doc):
        rect = page.rect
        text = str(start + idx)
        point = fitz.Point(rect.width * fx, rect.height * fy)
        page.insert_text(point, text, fontsize=11, color=(0.2, 0.2, 0.2))
    out = out_dir / f"{stem(src.name)}-numbered.pdf"
    doc.save(str(out))
    doc.close()
    return file_result(job_id, "add-page-numbers", out)


def watermark(job_id: str, src: Path, out_dir: Path, *, text: str = "CONFIDENTIAL", opacity: int = 30) -> JobResult:
    if not text:
        raise ProcessingError("Watermark text is required.")
    alpha = max(0.05, min(1.0, int(opacity) / 100))
    doc = fitz.open(str(src))
    fontname = "helv"
    for page in doc:
        rect = page.rect
        cx, cy = rect.width / 2, rect.height / 2
        diag = (rect.width**2 + rect.height**2) ** 0.5
        # Scale the font so the line spans ~72% of the page diagonal, clamped.
        base_fs = 50.0
        base_w = fitz.get_text_length(text, fontname=fontname, fontsize=base_fs) or 1.0
        fontsize = max(16.0, min(140.0, base_fs * (diag * 0.72) / base_w))
        tw = fitz.get_text_length(text, fontname=fontname, fontsize=fontsize)
        # Baseline placed so a single line is centred on the page, then the whole
        # thing is rotated 45° about the page centre → a true centred diagonal.
        point = fitz.Point(cx - tw / 2, cy + fontsize * 0.35)
        morph = (fitz.Point(cx, cy), fitz.Matrix(1, 1).prerotate(45))
        page.insert_text(
            point,
            text,
            fontname=fontname,
            fontsize=fontsize,
            color=(0.5, 0.5, 0.5),
            fill_opacity=alpha,
            morph=morph,
        )
    out = out_dir / f"{stem(src.name)}-watermarked.pdf"
    doc.save(str(out))
    doc.close()
    return file_result(job_id, "watermark-pdf", out, meta={"opacity": opacity})
