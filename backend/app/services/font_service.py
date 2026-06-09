"""Font conversion between TTF / OTF / WOFF / WOFF2 using fontTools."""
from __future__ import annotations

from pathlib import Path

from fontTools.ttLib import TTFont

from app.core.errors import ProcessingError
from app.schemas.jobs import JobResult
from app.services.base import file_result, stem

# flavor=None for raw sfnt (ttf/otf); woff/woff2 set the flavor.
_FLAVORS: dict[str, str | None] = {
    "ttf": None,
    "otf": None,
    "woff": "woff",
    "woff2": "woff2",  # requires the `brotli` package
}


def convert(job_id: str, src: Path, out_dir: Path, *, target: str = "woff2") -> JobResult:
    target = target.lower()
    if target not in _FLAVORS:
        raise ProcessingError(f"Unsupported font format '{target}'.")
    try:
        font = TTFont(str(src))
    except Exception as exc:  # noqa: BLE001
        raise ProcessingError("Could not read the font file. Is it a valid TTF/OTF/WOFF?") from exc

    font.flavor = _FLAVORS[target]
    out = out_dir / f"{stem(src.name)}.{target}"
    try:
        font.save(str(out))
    except Exception as exc:  # noqa: BLE001
        raise ProcessingError(f"Font conversion failed: {exc}") from exc
    return file_result(job_id, "font-converter", out, meta={"format": target})
