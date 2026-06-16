"""AI image tools: background removal, upscaling/enhancement, restore/colorize, captioning.

Heavy engines (rembg, OpenCV, the Anthropic SDK) are imported lazily inside each
function so the app boots even when a particular engine isn't installed — a
missing engine surfaces as a clear ProcessingError instead of an import crash.
"""
from __future__ import annotations

import logging
from pathlib import Path

import httpx

from app.config import settings
from app.core.errors import ProcessingError
from app.schemas.jobs import JobResult
from app.services.base import file_result, stem, text_result

logger = logging.getLogger("aio.ai.image")


# ── Background removal (rembg) ──────────────────────────────────────
_BG_MODELS = {
    "general": "u2net",            # best all-round quality
    "portrait": "u2net_human_seg",  # tuned for people
    "fast": "u2netp",              # lighter / quicker
}

_SOLID_BG = {
    "white": (255, 255, 255, 255),
    "black": (0, 0, 0, 255),
    "green": (16, 185, 129, 255),  # chroma-key friendly
    "blue": (37, 99, 235, 255),
}


def remove_background(
    job_id: str,
    src: Path,
    out_dir: Path,
    *,
    model: str = "general",
    background: str = "transparent",
    edges: bool = False,
) -> JobResult:
    try:
        from rembg import new_session, remove
    except Exception as exc:  # noqa: BLE001
        raise ProcessingError(
            "Background removal isn't available on this server (the 'rembg' engine is not installed)."
        ) from exc
    from PIL import Image, ImageOps

    img = ImageOps.exif_transpose(Image.open(str(src))).convert("RGBA")
    session = new_session(_BG_MODELS.get(model, "u2net"))
    cut = remove(
        img,
        session=session,
        alpha_matting=bool(edges),
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=10,
    )

    bg = _SOLID_BG.get(background)
    if bg is not None:
        canvas = Image.new("RGBA", cut.size, bg)
        canvas.alpha_composite(cut)
        cut = canvas

    out = out_dir / f"{stem(src.name)}-no-bg.png"
    cut.save(out, "PNG")
    return file_result(
        job_id, "background-remover", out, meta={"model": model, "background": background, "edges": edges}
    )


# ── Upscale / enhance (Pillow) ──────────────────────────────────────
# Real-ESRGAN gives the best results but needs torch + ideally a GPU, which
# isn't viable on a free CPU tier. This high-quality Lanczos + sharpening +
# enhancement pipeline runs instantly anywhere and looks great for most images.
# To plug a GAN model in later, branch here on a settings flag and return early.
_MAX_INPUT_PIXELS = 40_000_000   # ~40MP — covers virtually all phone/camera photos
_MAX_OUTPUT_LONG_SIDE = 8000     # cap the output's longest edge to keep memory sane


def upscale(
    job_id: str,
    src: Path,
    out_dir: Path,
    *,
    scale: int = 2,
    denoise: bool = False,
    sharpen: bool = True,
) -> JobResult:
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps

    requested = 4 if int(scale) >= 4 else (3 if int(scale) == 3 else 2)
    img = ImageOps.exif_transpose(Image.open(str(src)))
    has_alpha = img.mode in ("RGBA", "LA", "P")
    img = img.convert("RGBA" if has_alpha else "RGB")

    w, h = img.size
    if w * h > _MAX_INPUT_PIXELS:
        raise ProcessingError("This image is extremely large — please use one under ~40 megapixels.")

    # Scale by the requested factor, but never let the longest output edge exceed
    # the cap (so big inputs upscale by a smaller, safe factor instead of failing).
    factor = float(requested)
    longest = max(w, h)
    if longest * factor > _MAX_OUTPUT_LONG_SIDE:
        factor = max(1.0, _MAX_OUTPUT_LONG_SIDE / longest)
    new_size = (max(1, round(w * factor)), max(1, round(h * factor)))

    if denoise:
        img = _cv_denoise(img)

    up = img.resize(new_size, Image.LANCZOS)

    if sharpen:
        up = up.filter(ImageFilter.UnsharpMask(radius=2.2, percent=130, threshold=2))
        up = ImageEnhance.Sharpness(up).enhance(1.12)
    up = ImageEnhance.Contrast(up).enhance(1.04)
    up = ImageEnhance.Color(up).enhance(1.05)

    ext = ".png" if has_alpha else ".jpg"
    out = out_dir / f"{stem(src.name)}-upscaled{ext}"
    if ext == ".jpg":
        up.convert("RGB").save(out, "JPEG", quality=92, optimize=True)
    else:
        up.save(out, "PNG", optimize=True)
    return file_result(
        job_id,
        "image-upscaler",
        out,
        meta={"scale": round(factor, 2), "size": f"{new_size[0]}x{new_size[1]}", "denoise": denoise, "sharpen": sharpen},
    )


# ── Restore / colorize (OpenCV) ─────────────────────────────────────
def restore(
    job_id: str,
    src: Path,
    out_dir: Path,
    *,
    colorize: bool = False,
    enhance: bool = True,
) -> JobResult:
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps

    img = ImageOps.exif_transpose(Image.open(str(src))).convert("RGB")
    colorized = False

    if colorize:
        try:
            img = _colorize(img)
            colorized = True
        except ProcessingError:
            raise  # surface a clear "couldn't download the model" message
        except Exception as exc:  # noqa: BLE001
            raise ProcessingError(f"Colorization failed: {exc}") from exc

    if enhance:
        img = _cv_denoise(img)
        img = ImageOps.autocontrast(img, cutoff=1)
        img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=110, threshold=3))
        img = ImageEnhance.Color(img).enhance(1.08)

    out = out_dir / f"{stem(src.name)}-restored.jpg"
    img.convert("RGB").save(out, "JPEG", quality=93, optimize=True)
    return file_result(
        job_id, "photo-restore", out, meta={"colorized": colorized, "enhanced": enhance}
    )


def _cv_denoise(pil_img):
    """Best-effort fast denoise via OpenCV; returns the image unchanged if cv2 is absent."""
    try:
        import cv2
        import numpy as np
    except Exception:  # noqa: BLE001
        return pil_img
    from PIL import Image

    mode = pil_img.mode
    arr = np.array(pil_img.convert("RGB"))
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    out = cv2.fastNlMeansDenoisingColored(bgr, None, 3, 3, 7, 21)
    rgb = cv2.cvtColor(out, cv2.COLOR_BGR2RGB)
    result = Image.fromarray(rgb)
    return result.convert(mode) if mode != "RGB" else result


def _colorize(pil_img):
    """Colorize a grayscale image using Zhang et al.'s Caffe model via OpenCV DNN."""
    import cv2
    import numpy as np

    proto, model, pts = _ensure_colorization_model()
    net = cv2.dnn.readNetFromCaffe(str(proto), str(model))
    cluster = np.load(str(pts))

    class8 = net.getLayerId("class8_ab")
    conv8 = net.getLayerId("conv8_313_rh")
    cluster = cluster.transpose().reshape(2, 313, 1, 1).astype(np.float32)
    net.getLayer(class8).blobs = [cluster]
    net.getLayer(conv8).blobs = [np.full((1, 313), 2.606, np.float32)]

    rgb = (np.array(pil_img).astype(np.float32) / 255.0)
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l = cv2.split(lab)[0]
    l_rs = cv2.resize(l, (224, 224)) - 50

    net.setInput(cv2.dnn.blobFromImage(l_rs))
    ab = net.forward()[0].transpose((1, 2, 0))
    ab = cv2.resize(ab, (pil_img.width, pil_img.height))

    colorized = np.concatenate((l[:, :, np.newaxis], ab), axis=2)
    colorized = cv2.cvtColor(colorized, cv2.COLOR_LAB2RGB)
    colorized = np.clip(colorized, 0, 1)
    from PIL import Image

    return Image.fromarray((colorized * 255).astype("uint8"))


def _colorize_urls() -> dict[str, str]:
    # prototxt + cluster points are small and live in the richzhang repo; the
    # 123 MB caffemodel URL is configurable (defaults to a stable mirror).
    return {
        "colorization_deploy_v2.prototxt": "https://raw.githubusercontent.com/richzhang/colorization/caffe/colorization/models/colorization_deploy_v2.prototxt",
        "pts_in_hull.npy": "https://raw.githubusercontent.com/richzhang/colorization/caffe/colorization/resources/pts_in_hull.npy",
        "colorization_release_v2.caffemodel": settings.colorize_model_url,
    }


def _ensure_colorization_model() -> tuple[Path, Path, Path]:
    """Download the colorization model files to a cache dir on first use."""
    cache = settings.storage_path / ".models" / "colorize"
    cache.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    for name, url in _colorize_urls().items():
        dest = cache / name
        # The caffemodel is ~123 MB; anything tiny is an error page, not a model.
        min_size = 1_000_000 if name.endswith(".caffemodel") else 100
        if not dest.is_file() or dest.stat().st_size < min_size:
            try:
                with httpx.stream("GET", url, follow_redirects=True, timeout=300) as r:
                    r.raise_for_status()
                    with dest.open("wb") as f:
                        for chunk in r.iter_bytes():
                            f.write(chunk)
            except Exception as exc:  # noqa: BLE001
                dest.unlink(missing_ok=True)
                raise ProcessingError(
                    f"Could not download the colorization model ({name}). "
                    "Set COLORIZE_MODEL_URL to a reachable mirror and try again."
                ) from exc
            if dest.stat().st_size < min_size:  # got an error page, not the model
                dest.unlink(missing_ok=True)
                raise ProcessingError(
                    f"The colorization model download for {name} looked invalid (too small). "
                    "Set COLORIZE_MODEL_URL to a working mirror."
                )
        paths[name] = dest
    return (
        paths["colorization_deploy_v2.prototxt"],
        paths["colorization_release_v2.caffemodel"],
        paths["pts_in_hull.npy"],
    )


# ── Caption / alt-text (Claude vision) ──────────────────────────────
_CAPTION_PROMPTS = {
    "alt": (
        "Write a single concise, factual alt-text description of this image for web "
        "accessibility (max 18 words). No 'image of' prefix. Reply with the alt text only."
    ),
    "detailed": (
        "Describe this image in 2–4 vivid sentences: subject, setting, colours, mood and "
        "any visible text. Reply with the description only."
    ),
    "keywords": (
        "List 10–15 comma-separated SEO keywords/tags that describe this image, ordered by "
        "relevance. Reply with the comma-separated list only."
    ),
}


def caption(job_id: str, src: Path, *, style: str = "alt", language: str = "English") -> JobResult:
    from app.core import llm

    if not llm.llm_available():
        raise ProcessingError(
            "Image captioning needs an AI vision model. Set GEMINI_API_KEY (Google AI Studio) on the server to enable it."
        )
    prompt = _CAPTION_PROMPTS.get(style, _CAPTION_PROMPTS["alt"])
    if language and language.lower() != "english":
        prompt += f" Respond in {language}."
    try:
        text = llm.describe_image(src, prompt, max_tokens=600)
    except Exception as exc:  # noqa: BLE001
        raise ProcessingError(f"Captioning failed: {exc}") from exc
    if not text:
        raise ProcessingError("The model did not return a caption. Please try another image.")
    return text_result(job_id, "image-caption", text, meta={"style": style, "language": language})
