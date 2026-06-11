---
title: All In One Converter API
emoji: 🛠️
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 8000
pinned: false
---

# All in one converter — API

FastAPI backend for the All-in-one Converter. Processes PDF, document, image,
OCR, archive, audio, video and font files. Runs `ffmpeg`, `tesseract` and
`LibreOffice`, which is why it lives in a Docker container.

This folder is deployed to **Hugging Face Spaces** (Docker SDK). The frontend
(Next.js) is deployed separately on **Vercel** and calls this API.

## Endpoints
- `GET /api/health` — liveness + binary capabilities
- `GET /docs` — interactive API docs (Swagger)
- `POST /api/<category>/<tool>` — processing endpoints (auth + per-plan quotas enforced)

## Required Space settings
Set these under **Settings → Variables and secrets**:

**Secrets** (encrypted):
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key (full DB access — never commit)
- `APP_SECRET_KEY` — any long random string

**Variables**:
- `ENVIRONMENT` = `production`
- `SUPABASE_URL` = `https://<your-ref>.supabase.co`
- `MAX_UPLOAD_MB` = `1024`
- `CORS_ORIGINS` = your custom frontend domain (optional — every `*.vercel.app` URL is already allowed)

> Free Spaces have no persistent disk; `/app/storage` is ephemeral, which is
> fine because processed files auto-delete after `FILE_RETENTION_MINUTES` (60).

See [`../DEPLOYMENT.md`](../DEPLOYMENT.md) for the full deploy guide.
