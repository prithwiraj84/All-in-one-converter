"""Manual smoke test: exercises every tool endpoint with generated sample files.

Run from the backend/ directory with the project venv:

    .venv\\Scripts\\python.exe smoke_test.py

It prints a per-tool table:  OK | NEEDS BINARY (503) | FAIL
so you can see exactly which tools work on the current machine.
"""
from __future__ import annotations

import io
import wave
import zipfile
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
RESULTS: list[tuple[str, str, str]] = []


# ── sample-file generators ─────────────────────────────────────────
def pdf_bytes(text: str = "All in one converter smoke test. Hello world 12345.", pages: int = 1) -> bytes:
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page()
        page.insert_text((72, 72), f"{text} (page {i + 1})", fontsize=14)
    data = doc.tobytes()
    doc.close()
    return data


def png_bytes(text: str | None = None) -> bytes:
    img = Image.new("RGB", (320, 100), (245, 245, 250))
    if text:
        ImageDraw.Draw(img).text((10, 40), text, fill=(10, 10, 10))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def jpg_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (200, 200), (200, 60, 60)).save(buf, "JPEG")
    return buf.getvalue()


def zip_bytes() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("hello.txt", "hello from inside the archive")
        zf.writestr("folder/note.txt", "nested file")
    return buf.getvalue()


def wav_bytes() -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(b"\x00\x00" * 8000)  # 1 second of silence
    return buf.getvalue()


def encrypted_pdf_bytes(password: str) -> bytes:
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(io.BytesIO(pdf_bytes()))
    writer = PdfWriter()
    for p in reader.pages:
        writer.add_page(p)
    writer.encrypt(password, algorithm="AES-256")
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


WIN_FONT = Path("C:/Windows/Fonts/arial.ttf")


def run(label: str, endpoint: str, files: list, data: dict | None = None) -> None:
    try:
        res = client.post(endpoint, files=files, data=data or {})
    except Exception as exc:  # noqa: BLE001
        RESULTS.append((label, "FAIL", f"exception: {exc}"))
        return

    if res.status_code == 200:
        body = res.json()
        if body.get("download_url"):
            dl = client.get(body["download_url"])
            detail = f"{body.get('output_filename')} ({dl.status_code}, {len(dl.content)} bytes)"
        elif body.get("text") is not None:
            detail = f"text: {len(body['text'])} chars"
        else:
            detail = "200 (no output?)"
        RESULTS.append((label, "OK", detail))
    elif res.status_code == 503:
        RESULTS.append((label, "NEEDS BINARY", res.json().get("detail", "")[:70]))
    else:
        try:
            detail = res.json().get("detail", res.text)
        except Exception:  # noqa: BLE001
            detail = res.text
        RESULTS.append((label, f"FAIL {res.status_code}", str(detail)[:80]))


def pdf_file(name="a.pdf"):
    return ("files", (name, pdf_bytes(), "application/pdf"))


def main() -> None:
    # ── PDF ────────────────────────────────────────────────────────
    run("merge-pdf", "/api/pdf/merge", [pdf_file("a.pdf"), pdf_file("b.pdf")])
    run("split-pdf", "/api/pdf/split", [("files", ("doc.pdf", pdf_bytes(pages=3), "application/pdf"))], {"ranges": "1,3"})
    run("compress-pdf", "/api/pdf/compress", [pdf_file()], {"level": "recommended"})
    run("rotate-pdf", "/api/pdf/rotate", [pdf_file()], {"angle": "90"})
    run("protect-pdf", "/api/pdf/protect", [pdf_file()], {"password": "secret123"})
    run("unlock-pdf", "/api/pdf/unlock",
        [("files", ("locked.pdf", encrypted_pdf_bytes("secret123"), "application/pdf"))], {"password": "secret123"})
    run("add-page-numbers", "/api/pdf/page-numbers", [pdf_file()], {"position": "bottom-center", "start": "1"})
    run("watermark-pdf", "/api/pdf/watermark", [pdf_file()], {"text": "CONFIDENTIAL", "opacity": "30"})

    # ── Image ──────────────────────────────────────────────────────
    run("image-converter", "/api/image/convert", [("files", ("p.png", png_bytes(), "image/png"))], {"target": "jpg"})
    run("resize-image", "/api/image/resize", [("files", ("p.png", png_bytes(), "image/png"))],
        {"width": "100", "height": "100", "keep_ratio": "true"})
    run("compress-image", "/api/image/compress", [("files", ("p.jpg", jpg_bytes(), "image/jpeg"))], {"quality": "70"})

    # ── OCR ────────────────────────────────────────────────────────
    run("pdf-to-text", "/api/ocr/pdf", [pdf_file()])  # embedded text → no tesseract needed
    run("image-to-text", "/api/ocr/image", [("files", ("t.png", png_bytes("Hello OCR 123"), "image/png"))])

    # ── Document (LibreOffice; pdf-to-excel uses pdfplumber) ───────
    run("pdf-to-excel", "/api/document/pdf-to-excel", [pdf_file()])
    run("pdf-to-word", "/api/document/pdf-to-word", [pdf_file()])

    # ── Archive ────────────────────────────────────────────────────
    run("zip-extractor", "/api/archive/extract", [("files", ("a.zip", zip_bytes(), "application/zip"))])
    run("archive-converter", "/api/archive/convert", [("files", ("a.zip", zip_bytes(), "application/zip"))], {"target": "tar.gz"})

    # ── Audio / Video (FFmpeg) ─────────────────────────────────────
    run("audio-converter", "/api/audio/convert", [("files", ("s.wav", wav_bytes(), "audio/wav"))], {"target": "mp3"})

    # ── Font ───────────────────────────────────────────────────────
    if WIN_FONT.exists():
        run("font-converter", "/api/font/convert",
            [("files", ("arial.ttf", WIN_FONT.read_bytes(), "font/ttf"))], {"target": "woff2"})
    else:
        RESULTS.append(("font-converter", "SKIP", "no sample TTF on this machine"))

    # ── AI ─────────────────────────────────────────────────────────
    run("ai-summarize", "/api/ai/summarize",
        [("files", ("doc.txt", b"All in one converter is a platform. " * 30, "text/plain"))], {"max_sentences": "3"})

    # ── report ─────────────────────────────────────────────────────
    print("\n" + "=" * 78)
    print(f"{'TOOL':<20} {'RESULT':<16} DETAIL")
    print("-" * 78)
    counts: dict[str, int] = {}
    for label, status, detail in RESULTS:
        key = status.split()[0]
        counts[key] = counts.get(key, 0) + 1
        print(f"{label:<20} {status:<16} {detail}")
    print("=" * 78)
    print("Summary:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))


if __name__ == "__main__":
    main()
