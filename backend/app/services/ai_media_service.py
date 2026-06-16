"""AI media tools: speech-to-text + subtitles (faster-whisper) and text-to-speech (edge-tts).

Whisper and edge-tts are imported lazily so the app boots without them; FFmpeg
(already required for the audio/video converters) is reused to normalise audio.
"""
from __future__ import annotations

import threading
from pathlib import Path

from app.config import settings
from app.core.errors import ProcessingError
from app.schemas.jobs import JobResult
from app.services.base import ensure_binary, file_result, run_command, stem, text_result
from app.services.text_extract import extract_text

# Cap how much audio we transcribe / synthesize on the free CPU tier.
_MAX_TTS_CHARS = 20_000


# ── Speech → text (faster-whisper) ──────────────────────────────────
def _to_wav(src: Path, out_dir: Path) -> Path:
    """Normalise any audio/video input to 16 kHz mono WAV for Whisper."""
    ffmpeg = ensure_binary(settings.ffmpeg_cmd)
    wav = out_dir / "audio16k.wav"
    run_command([ffmpeg, "-y", "-i", str(src), "-vn", "-ar", "16000", "-ac", "1", str(wav)], timeout=600)
    return wav


_whisper_model = None
_whisper_lock = threading.Lock()


def _get_whisper():
    """Load the Whisper model once and reuse it (saves the ~140 MB reload + the
    CPU/thread churn of recreating it on every request). The model is thread-safe
    for concurrent transcription."""
    global _whisper_model
    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel
        except Exception as exc:  # noqa: BLE001
            raise ProcessingError(
                "Transcription isn't available on this server (the 'faster-whisper' engine is not installed)."
            ) from exc
        with _whisper_lock:
            if _whisper_model is None:
                _whisper_model = WhisperModel(
                    settings.whisper_model,
                    device="cpu",
                    compute_type="int8",
                    cpu_threads=max(1, settings.whisper_cpu_threads),
                )
    return _whisper_model


def _whisper_segments(wav: Path, *, language: str, translate: bool):
    model = _get_whisper()
    segments, info = model.transcribe(
        str(wav),
        language=None if language in ("", "auto") else language,
        task="translate" if translate else "transcribe",
        vad_filter=True,
        beam_size=1,
    )
    return list(segments), info


def transcribe(
    job_id: str,
    src: Path,
    out_dir: Path,
    *,
    language: str = "auto",
    translate: bool = False,
) -> JobResult:
    wav = _to_wav(src, out_dir)
    segments, info = _whisper_segments(wav, language=language, translate=translate)
    text = "\n".join(s.text.strip() for s in segments).strip()
    if not text:
        raise ProcessingError("No speech could be detected in this file.")
    return text_result(
        job_id,
        "audio-to-text",
        text,
        meta={"language": getattr(info, "language", language), "translated": translate},
    )


def _fmt_ts(seconds: float, *, vtt: bool) -> str:
    if seconds < 0:
        seconds = 0
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    sep = "." if vtt else ","
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def subtitles(
    job_id: str,
    src: Path,
    out_dir: Path,
    *,
    fmt: str = "srt",
    language: str = "auto",
    translate: bool = False,
) -> JobResult:
    fmt = "vtt" if str(fmt).lower() == "vtt" else "srt"
    wav = _to_wav(src, out_dir)
    segments, _ = _whisper_segments(wav, language=language, translate=translate)
    if not segments:
        raise ProcessingError("No speech could be detected in this file.")

    is_vtt = fmt == "vtt"
    lines: list[str] = ["WEBVTT", ""] if is_vtt else []
    for i, seg in enumerate(segments, start=1):
        start, end = _fmt_ts(seg.start, vtt=is_vtt), _fmt_ts(seg.end, vtt=is_vtt)
        if not is_vtt:
            lines.append(str(i))
        lines.append(f"{start} --> {end}")
        lines.append(seg.text.strip())
        lines.append("")

    out = out_dir / f"{stem(src.name)}.{fmt}"
    out.write_text("\n".join(lines), encoding="utf-8")
    return file_result(job_id, "video-to-subtitles", out, meta={"format": fmt, "segments": len(segments)})


# ── Text → speech (edge-tts, with a gTTS fallback) ──────────────────
_TTS_SPEED = {"slow": "-20%", "normal": "+0%", "fast": "+20%"}


def _run_async(coro):
    """Run a coroutine from a worker thread with a fresh event loop.

    On Windows the default Proactor loop misbehaves off the main thread, so use a
    Selector loop there (aiohttp / edge-tts work fine on it)."""
    import asyncio
    import sys

    loop = asyncio.SelectorEventLoop() if sys.platform.startswith("win") else asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _edge_synthesize(text: str, voice: str, rate: str, dest: Path) -> None:
    import edge_tts

    await edge_tts.Communicate(text, voice, rate=rate).save(str(dest))


def _gtts_synthesize(text: str, voice: str, dest: Path) -> None:
    from gtts import gTTS

    lang = (voice.split("-", 1)[0] or "en").lower()  # "en-US-JennyNeural" -> "en"
    gTTS(text=text, lang=lang).save(str(dest))


def text_to_speech(
    job_id: str,
    src: Path,
    out_dir: Path,
    *,
    voice: str = "en-US-JennyNeural",
    speed: str = "normal",
    fmt: str = "mp3",
) -> JobResult:
    text = extract_text(src)
    if len(text) > _MAX_TTS_CHARS:
        text = text[:_MAX_TTS_CHARS]
    rate = _TTS_SPEED.get(str(speed).lower(), "+0%")
    out = out_dir / f"{stem(src.name)}.mp3"

    errors: list[str] = []
    engine: str | None = None

    # 1) edge-tts — natural neural voices (needs outbound internet).
    try:
        _run_async(_edge_synthesize(text, voice, rate, out))
        if out.is_file() and out.stat().st_size > 0:
            engine = "edge-tts"
    except Exception as exc:  # noqa: BLE001
        errors.append(f"edge-tts: {str(exc)[:140]}")

    # 2) gTTS — simpler but very reliable fallback.
    if engine is None:
        try:
            _gtts_synthesize(text, voice, out)
            if out.is_file() and out.stat().st_size > 0:
                engine = "gtts"
        except Exception as exc:  # noqa: BLE001
            errors.append(f"gTTS: {str(exc)[:140]}")

    if engine is None:
        raise ProcessingError(
            "Speech synthesis failed — the voice services were unreachable. " + " | ".join(errors)
        )
    return file_result(
        job_id,
        "pdf-to-audio",
        out,
        meta={"voice": voice, "speed": speed, "engine": engine, "chars": len(text)},
    )
