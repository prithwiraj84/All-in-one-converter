"""Image processing with Pillow: convert, resize, compress."""
from __future__ import annotations

import zipfile
from pathlib import Path

from PIL import Image, ImageOps

from app.core.errors import ProcessingError
from app.schemas.jobs import JobResult
from app.services.base import file_result, stem

# Pillow save format names per target extension.
_FORMATS = {
    "jpg": ("JPEG", ".jpg"),
    "jpeg": ("JPEG", ".jpg"),
    "png": ("PNG", ".png"),
    "webp": ("WEBP", ".webp"),
    "gif": ("GIF", ".gif"),
    "bmp": ("BMP", ".bmp"),
    "tiff": ("TIFF", ".tiff"),
}


def _open(path: Path) -> Image.Image:
    try:
        img = Image.open(path)
        return ImageOps.exif_transpose(img)
    except Exception as exc:  # noqa: BLE001
        raise ProcessingError(f"Could not read image '{path.name}'.") from exc


def _flatten_for_jpeg(img: Image.Image) -> Image.Image:
    if img.mode in ("RGBA", "LA", "P"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        rgba = img.convert("RGBA")
        background.paste(rgba, mask=rgba.split()[-1])
        return background
    return img.convert("RGB")


def _save(img: Image.Image, dest: Path, fmt: str, *, quality: int = 90) -> None:
    if fmt in ("JPEG", "WEBP"):
        if fmt == "JPEG":
            img = _flatten_for_jpeg(img)
        img.save(dest, fmt, quality=quality, optimize=True)
    elif fmt == "PNG":
        img.save(dest, fmt, optimize=True)
    else:
        img.save(dest, fmt)


def _convert_one(src: Path, out_dir: Path, target: str) -> Path:
    fmt, ext = _FORMATS[target]
    img = _open(src)
    dest = out_dir / f"{stem(src.name)}{ext}"
    _save(img, dest, fmt, quality=90)
    return dest


def convert(job_id: str, inputs: list[Path], out_dir: Path, *, target: str = "png") -> JobResult:
    target = target.lower()
    if target not in _FORMATS:
        raise ProcessingError(f"Unsupported target format '{target}'.")

    if len(inputs) == 1:
        dest = _convert_one(inputs[0], out_dir, target)
        return file_result(job_id, "image-converter", dest, meta={"format": target})

    # Batch → zip the results.
    out = out_dir / f"converted-{target}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for src in inputs:
            dest = _convert_one(src, out_dir, target)
            zf.write(dest, arcname=dest.name)
            dest.unlink(missing_ok=True)
    return file_result(job_id, "image-converter", out, meta={"format": target, "count": len(inputs)})


def resize(job_id: str, inputs: list[Path], out_dir: Path, *, width: int = 1280, height: int = 720, keep_ratio: bool = True) -> JobResult:
    width, height = max(1, int(width)), max(1, int(height))

    def _resize_one(src: Path) -> Path:
        img = _open(src)
        if keep_ratio:
            img = img.copy()
            img.thumbnail((width, height), Image.Resampling.LANCZOS)
        else:
            img = img.resize((width, height), Image.Resampling.LANCZOS)
        dest = out_dir / f"{stem(src.name)}-resized{src.suffix or '.png'}"
        img.save(dest)
        return dest

    if len(inputs) == 1:
        return file_result(job_id, "resize-image", _resize_one(inputs[0]), meta={"width": width, "height": height})

    out = out_dir / "resized.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for src in inputs:
            dest = _resize_one(src)
            zf.write(dest, arcname=dest.name)
            dest.unlink(missing_ok=True)
    return file_result(job_id, "resize-image", out, meta={"width": width, "height": height, "count": len(inputs)})


def compress(job_id: str, inputs: list[Path], out_dir: Path, *, quality: int = 80) -> JobResult:
    quality = max(10, min(100, int(quality)))

    def _compress_one(src: Path) -> Path:
        img = _open(src)
        ext = src.suffix.lower().lstrip(".") or "jpg"
        if ext in ("jpg", "jpeg"):
            fmt, out_ext = "JPEG", ".jpg"
        elif ext == "webp":
            fmt, out_ext = "WEBP", ".webp"
        elif ext == "png":
            fmt, out_ext = "PNG", ".png"
        else:
            fmt, out_ext = "JPEG", ".jpg"
        dest = out_dir / f"{stem(src.name)}-compressed{out_ext}"
        _save(img, dest, fmt, quality=quality)
        return dest

    if len(inputs) == 1:
        src = inputs[0]
        dest = _compress_one(src)
        before, after = src.stat().st_size, dest.stat().st_size
        saved = max(0, round((1 - after / before) * 100)) if before else 0
        return file_result(job_id, "compress-image", dest, meta={"quality": quality, "reduced_percent": saved})

    out = out_dir / "compressed.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for src in inputs:
            dest = _compress_one(src)
            zf.write(dest, arcname=dest.name)
            dest.unlink(missing_ok=True)
    return file_result(job_id, "compress-image", out, meta={"quality": quality, "count": len(inputs)})
