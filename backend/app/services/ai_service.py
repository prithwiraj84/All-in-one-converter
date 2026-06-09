"""AI document summarizer.

This ships with a fast, dependency-free extractive summarizer so the tool works
out of the box. For production-grade summaries, swap `_summarize` to call an LLM
(e.g. Anthropic's Claude) using the document text.
"""
from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

import fitz  # PyMuPDF

from app.core.errors import ProcessingError
from app.schemas.jobs import JobResult
from app.services.base import text_result

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
    "is", "are", "was", "were", "be", "been", "it", "this", "that", "these",
    "those", "as", "at", "by", "from", "we", "you", "they", "he", "she", "i",
}


def _extract_text(src: Path) -> str:
    if src.suffix.lower() == ".pdf":
        doc = fitz.open(str(src))
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        return text
    return src.read_text(encoding="utf-8", errors="ignore")


def _summarize(text: str, max_sentences: int = 7) -> str:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    sentences = [s.strip() for s in sentences if len(s.strip()) > 25]
    if len(sentences) <= max_sentences:
        return " ".join(sentences)

    words = re.findall(r"[a-zA-Z]{3,}", text.lower())
    freq = Counter(w for w in words if w not in _STOPWORDS)
    if not freq:
        return " ".join(sentences[:max_sentences])
    top = freq.most_common(1)[0][1]

    scored: list[tuple[int, float]] = []
    for idx, sentence in enumerate(sentences):
        sw = re.findall(r"[a-zA-Z]{3,}", sentence.lower())
        if not sw:
            continue
        score = sum(freq.get(w, 0) / top for w in sw) / len(sw)
        scored.append((idx, score))

    best = sorted(scored, key=lambda x: x[1], reverse=True)[:max_sentences]
    chosen = sorted(i for i, _ in best)
    return " ".join(sentences[i] for i in chosen)


def summarize(job_id: str, src: Path, *, max_sentences: int = 7) -> JobResult:
    text = _extract_text(src)
    if not text.strip():
        raise ProcessingError("No readable text found in the document.")
    summary = _summarize(text, max_sentences)
    return text_result(
        job_id,
        "ai-summarize",
        summary,
        meta={
            "source_chars": len(text),
            "summary_chars": len(summary),
            "engine": "extractive-heuristic",
            "note": "Connect an LLM in ai_service.py for production-grade summaries.",
        },
    )
