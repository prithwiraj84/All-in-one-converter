"""Optional LLM integration — Google Gemini (preferred) or Anthropic Claude.

Powers image captioning and (optionally) higher-quality translation. The
provider is chosen by whichever API key is configured: GEMINI_API_KEY wins,
then ANTHROPIC_API_KEY.

Gemini is called over its REST API with httpx (already a dependency) rather than
the google-genai SDK — the sync SDK client can close its underlying transport
inside a worker thread ("client has been closed"), so a plain request is more
robust here. Claude still uses its SDK (imported lazily).
"""
from __future__ import annotations

import base64
import io
from pathlib import Path

import httpx

from app.config import settings

_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


def _provider() -> str | None:
    if settings.gemini_api_key:
        return "gemini"
    if settings.anthropic_api_key:
        return "anthropic"
    return None


def llm_available() -> bool:
    return _provider() is not None


def _png_bytes(image_path: Path) -> bytes:
    """Normalise any image to PNG bytes (orientation-corrected) for vision calls."""
    from PIL import Image, ImageOps

    img = ImageOps.exif_transpose(Image.open(str(image_path))).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


# ── Google Gemini (REST via httpx) ──────────────────────────────────
def _gemini_generate(parts: list[dict], system: str | None, max_tokens: int) -> str:
    payload: dict = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"maxOutputTokens": max_tokens},
    }
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}

    url = f"{_GEMINI_BASE}/models/{settings.gemini_model}:generateContent"
    with httpx.Client(timeout=120) as client:
        resp = client.post(url, headers={"x-goog-api-key": settings.gemini_api_key}, json=payload)

    if resp.status_code != 200:
        detail = ""
        try:
            detail = resp.json().get("error", {}).get("message", "")
        except Exception:  # noqa: BLE001
            detail = resp.text[:300]
        raise RuntimeError(f"Gemini API error {resp.status_code}: {detail or 'request failed'}")

    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        reason = (data.get("promptFeedback") or {}).get("blockReason", "empty response")
        raise RuntimeError(f"Gemini returned no output ({reason}).")
    out_parts = (candidates[0].get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in out_parts).strip()


def _gemini_text(prompt: str, system: str | None, max_tokens: int) -> str:
    return _gemini_generate([{"text": prompt}], system, max_tokens)


def _gemini_vision(image_path: Path, prompt: str, max_tokens: int) -> str:
    b64 = base64.b64encode(_png_bytes(image_path)).decode("ascii")
    parts = [{"inlineData": {"mimeType": "image/png", "data": b64}}, {"text": prompt}]
    return _gemini_generate(parts, None, max_tokens)


# ── Anthropic Claude (fallback) ─────────────────────────────────────
def _anthropic_client():
    import anthropic

    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


def _anthropic_text(prompt: str, system: str | None, max_tokens: int) -> str:
    kwargs: dict = {
        "model": settings.anthropic_model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        kwargs["system"] = system
    msg = _anthropic_client().messages.create(**kwargs)
    return "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()


def _anthropic_vision(image_path: Path, prompt: str, max_tokens: int) -> str:
    data = base64.b64encode(_png_bytes(image_path)).decode("ascii")
    msg = _anthropic_client().messages.create(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": data}},
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )
    return "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()


# ── Provider-agnostic public API ────────────────────────────────────
def generate_text(prompt: str, *, system: str | None = None, max_tokens: int = 1500) -> str:
    provider = _provider()
    if provider == "gemini":
        return _gemini_text(prompt, system, max_tokens)
    if provider == "anthropic":
        return _anthropic_text(prompt, system, max_tokens)
    raise RuntimeError("No LLM provider configured (set GEMINI_API_KEY or ANTHROPIC_API_KEY).")


def describe_image(image_path: Path, prompt: str, *, max_tokens: int = 700) -> str:
    provider = _provider()
    if provider == "gemini":
        return _gemini_vision(image_path, prompt, max_tokens)
    if provider == "anthropic":
        return _anthropic_vision(image_path, prompt, max_tokens)
    raise RuntimeError("No LLM provider configured (set GEMINI_API_KEY or ANTHROPIC_API_KEY).")
