# ─────────────────────────────────────────────────────────────
# All in one converter — FastAPI backend
# Includes the system binaries the services shell out to:
# ffmpeg (audio/video), tesseract (OCR), libreoffice (documents).
# ─────────────────────────────────────────────────────────────
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    STORAGE_DIR=/app/storage \
    # AI model caches → writable storage (rembg, faster-whisper, etc.)
    XDG_CACHE_HOME=/app/storage/.cache \
    HF_HOME=/app/storage/.cache/huggingface \
    U2NET_HOME=/app/storage/.cache/u2net \
    NUMBA_CACHE_DIR=/app/storage/.cache/numba \
    MPLCONFIGDIR=/app/storage/.cache/mpl

WORKDIR /app

# System processing dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    tesseract-ocr \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-dejavu \
    libgl1 \
    libglib2.0-0 \
    unar \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# Non-root runtime user + writable storage
RUN useradd --create-home appuser \
    && mkdir -p /app/storage/.cache/huggingface /app/storage/.cache/u2net \
       /app/storage/.cache/numba /app/storage/.cache/mpl \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health').status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
