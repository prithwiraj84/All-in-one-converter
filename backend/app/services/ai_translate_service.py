"""AI document translator: PDF / DOCX / TXT → translated DOCX or TXT.

Uses Claude when an Anthropic key is configured (best quality, keeps tone),
otherwise falls back to the free Google engine via deep-translator so the tool
works out of the box.
"""
from __future__ import annotations

import logging
from pathlib import Path

from app.core.errors import ProcessingError
from app.schemas.jobs import JobResult
from app.services.base import file_result, stem
from app.services.text_extract import extract_text

logger = logging.getLogger("aio.ai.translate")

# Friendly names for the prompt + UI. Codes match deep-translator / Google.
LANGUAGES = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "it": "Italian", "pt": "Portuguese", "nl": "Dutch", "ru": "Russian",
    "ar": "Arabic", "hi": "Hindi", "bn": "Bengali", "zh-CN": "Chinese (Simplified)",
    "ja": "Japanese", "ko": "Korean", "tr": "Turkish", "vi": "Vietnamese",
    "id": "Indonesian", "pl": "Polish", "uk": "Ukrainian", "fa": "Persian",
}

_GOOGLE_CHUNK = 4500  # Google free endpoint caps ~5000 chars/request


def _chunk(text: str, size: int) -> list[str]:
    """Split on paragraph boundaries without exceeding `size` chars per chunk."""
    chunks: list[str] = []
    current = ""
    for para in text.split("\n"):
        if len(current) + len(para) + 1 > size and current:
            chunks.append(current)
            current = ""
        if len(para) > size:  # a single very long line
            for i in range(0, len(para), size):
                chunks.append(para[i : i + size])
            continue
        current += para + "\n"
    if current.strip():
        chunks.append(current)
    return chunks


def _translate_google(text: str, target: str, source: str) -> str:
    try:
        from deep_translator import GoogleTranslator
    except Exception as exc:  # noqa: BLE001
        raise ProcessingError(
            "Translation isn't available on this server (the 'deep-translator' engine is not installed)."
        ) from exc
    translator = GoogleTranslator(source=source or "auto", target=target)
    out: list[str] = []
    for part in _chunk(text, _GOOGLE_CHUNK):
        try:
            out.append(translator.translate(part) or "")
        except Exception as exc:  # noqa: BLE001
            raise ProcessingError(f"Translation failed: {exc}") from exc
    return "\n".join(out)


def _translate_llm(text: str, target_name: str) -> str:
    from app.core import llm

    out: list[str] = []
    for part in _chunk(text, 12_000):
        out.append(
            llm.generate_text(
                f"Translate the following text into {target_name}. Preserve meaning, tone and "
                f"paragraph breaks. Output only the translation, no preamble.\n\n{part}",
                max_tokens=4000,
            )
        )
    return "\n".join(out)


def _write_docx(text: str, dest: Path) -> None:
    from docx import Document

    doc = Document()
    for para in text.split("\n"):
        doc.add_paragraph(para)
    doc.save(str(dest))


def translate(
    job_id: str,
    src: Path,
    out_dir: Path,
    *,
    target: str = "es",
    source: str = "auto",
    fmt: str = "docx",
) -> JobResult:
    if target not in LANGUAGES:
        raise ProcessingError(f"Unsupported target language '{target}'.")
    text = extract_text(src)

    from app.core import llm

    if llm.llm_available():
        try:
            translated = _translate_llm(text, LANGUAGES[target])
            engine = "llm"
        except Exception as exc:  # noqa: BLE001 - fall back to the free engine
            logger.warning("LLM translation failed, falling back to Google: %s", exc)
            translated = _translate_google(text, target, source)
            engine = "google"
    else:
        translated = _translate_google(text, target, source)
        engine = "google"

    if not translated.strip():
        raise ProcessingError("The translation came back empty. Please try another document.")

    base = stem(src.name)
    if str(fmt).lower() == "txt":
        out = out_dir / f"{base}-{target}.txt"
        out.write_text(translated, encoding="utf-8")
    else:
        out = out_dir / f"{base}-{target}.docx"
        _write_docx(translated, out)

    return file_result(
        job_id, "document-translator", out, meta={"target": target, "source": source, "engine": engine}
    )
