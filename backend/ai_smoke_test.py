"""Smoke test for the AI tools (heavier — downloads models, needs internet).

Run from backend/ with the project venv:

    .venv\\Scripts\\python.exe ai_smoke_test.py

First run downloads the rembg (~170 MB) and Whisper (~140 MB) models, so give
it a few minutes. Captioning needs GEMINI_API_KEY (else it reports NEEDS KEY).
"""
from __future__ import annotations

import io
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from app.main import app

client = TestClient(app)
RESULTS: list[tuple[str, str, str]] = []


def png(w: int = 260, h: int = 180, gray: bool = False) -> bytes:
    if gray:
        import numpy as np

        yy, xx = np.mgrid[0:h, 0:w]
        g = ((xx / w * 200) + (yy / h * 40)).astype("uint8")
        img = Image.fromarray(g, "L").convert("RGB")
    else:
        img = Image.new("RGB", (w, h), (232, 232, 238))
        ImageDraw.Draw(img).ellipse([w // 4, h // 4, 3 * w // 4, 3 * h // 4], fill=(200, 60, 60))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def speech_mp3() -> bytes:
    """A short spoken clip via gTTS, so Whisper has real speech to transcribe."""
    from gtts import gTTS

    p = Path(tempfile.mktemp(suffix=".mp3"))
    gTTS("Hello world, testing one two three four five.").save(str(p))
    return p.read_bytes()


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
            RESULTS.append((label, "OK", f"{body.get('output_filename')} ({dl.status_code}, {len(dl.content)} bytes) meta={body.get('meta')}"))
        elif body.get("text") is not None:
            t = " ".join(body["text"].split())
            RESULTS.append((label, "OK", f"text[{len(body['text'])}]: {t[:64]}"))
        else:
            RESULTS.append((label, "OK", "200 (no output?)"))
    else:
        try:
            detail = res.json().get("detail", res.text)
        except Exception:  # noqa: BLE001
            detail = res.text
        status = "NEEDS KEY" if "GEMINI_API_KEY" in str(detail) else f"ERR {res.status_code}"
        RESULTS.append((label, status, str(detail)[:96]))


def main() -> None:
    run("background-remover", "/api/ai/remove-background",
        [("files", ("p.png", png(), "image/png"))], {"model": "general", "background": "white", "edges": "false"})
    run("image-upscaler", "/api/ai/upscale",
        [("files", ("p.png", png(), "image/png"))], {"scale": "2", "sharpen": "true", "denoise": "false"})
    run("photo-restore", "/api/ai/restore",
        [("files", ("bw.png", png(gray=True), "image/png"))], {"colorize": "true", "enhance": "true"})
    run("image-caption", "/api/ai/caption",
        [("files", ("p.png", png(), "image/png"))], {"style": "alt", "language": "English"})
    run("pdf-to-audio", "/api/ai/text-to-speech",
        [("files", ("d.txt", b"Hello world. This is a text to speech test. One two three.", "text/plain"))],
        {"voice": "en-US-JennyNeural", "speed": "normal"})

    try:
        spk = speech_mp3()
    except Exception as exc:  # noqa: BLE001
        spk = None
        RESULTS.append(("(speech gen)", "WARN", f"gTTS failed: {exc}"))

    if spk:
        run("audio-to-text", "/api/ai/transcribe",
            [("files", ("s.mp3", spk, "audio/mpeg"))], {"language": "en", "translate": "false"})
        run("video-to-subtitles", "/api/ai/subtitles",
            [("files", ("s.mp3", spk, "audio/mpeg"))], {"format": "srt", "language": "en", "translate": "false"})
    else:
        RESULTS.append(("audio-to-text", "SKIP", "no speech audio generated"))
        RESULTS.append(("video-to-subtitles", "SKIP", "no speech audio generated"))

    run("document-translator", "/api/ai/translate",
        [("files", ("d.txt", b"Hello world, how are you today? This is a translation test.", "text/plain"))],
        {"target": "es", "source": "auto", "format": "docx"})

    print("\n" + "=" * 92)
    print(f"{'AI TOOL':<22}{'RESULT':<14}DETAIL")
    print("-" * 92)
    counts: dict[str, int] = {}
    for label, status, detail in RESULTS:
        counts[status.split()[0]] = counts.get(status.split()[0], 0) + 1
        print(f"{label:<22}{status:<14}{detail}")
    print("=" * 92)
    print("Summary:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))


if __name__ == "__main__":
    main()
