"""Plain-text extraction from PDF / DOCX / TXT, shared by the AI doc tools."""
from __future__ import annotations

from pathlib import Path

from app.core.errors import ProcessingError


def extract_text(src: Path) -> str:
    ext = src.suffix.lower()
    if ext == ".pdf":
        import fitz  # PyMuPDF

        doc = fitz.open(str(src))
        try:
            text = "\n".join(page.get_text() for page in doc)
        finally:
            doc.close()
    elif ext == ".docx":
        from docx import Document  # python-docx

        doc = Document(str(src))
        text = "\n".join(p.text for p in doc.paragraphs)
    elif ext in (".txt", ".text", ".md"):
        text = src.read_text(encoding="utf-8", errors="ignore")
    else:
        raise ProcessingError(f"Unsupported document type '{ext}'. Use PDF, DOCX or TXT.")

    if not text.strip():
        raise ProcessingError("No readable text was found in the document.")
    return text
