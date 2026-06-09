"""OCR via Tesseract: image-to-text and pdf-to-text (with scanned fallback)."""
from __future__ import annotations

from pathlib import Path

import fitz  # PyMuPDF
import pytesseract
from PIL import Image

from app.config import settings
from app.core.errors import ProcessingError
from app.schemas.jobs import JobResult
from app.services.base import ensure_binary, text_result


def _configure_tesseract() -> None:
    pytesseract.pytesseract.tesseract_cmd = ensure_binary(settings.tesseract_cmd)


def image_to_text(job_id: str, src: Path, *, lang: str = "eng") -> JobResult:
    _configure_tesseract()
    try:
        with Image.open(src) as img:
            text = pytesseract.image_to_string(img, lang=lang)
    except pytesseract.TesseractError as exc:
        raise ProcessingError(f"OCR failed: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        raise ProcessingError("Could not read the image for OCR.") from exc
    return text_result(job_id, "image-to-text", text.strip(), meta={"chars": len(text), "lang": lang})


def pdf_to_text(job_id: str, src: Path, *, lang: str = "eng") -> JobResult:
    doc = fitz.open(str(src))
    parts: list[str] = []
    for page in doc:
        parts.append(page.get_text().strip())

    extracted = "\n\n".join(p for p in parts if p).strip()

    # Scanned PDF (no embedded text) → render pages and OCR them.
    if not extracted:
        _configure_tesseract()
        ocr_parts: list[str] = []
        for page in doc:
            pix = page.get_pixmap(dpi=200)
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            ocr_parts.append(pytesseract.image_to_string(img, lang=lang))
        extracted = "\n\n".join(ocr_parts).strip()
        method = "ocr"
    else:
        method = "embedded"

    doc.close()
    if not extracted:
        raise ProcessingError("No readable text could be extracted from this PDF.")
    return text_result(job_id, "pdf-to-text", extracted, meta={"method": method, "chars": len(extracted)})
