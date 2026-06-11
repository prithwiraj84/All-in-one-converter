# Deployment Guide — All in one converter

This guide covers Supabase setup, environment variables, and deploying the
**backend to Hugging Face Spaces** + **frontend to Vercel** (recommended), with
Render and plain Docker as alternatives.

---

## 1. Supabase

### 1.1 Create the project & schema
1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) and run it.
   This creates the `profiles`, `files`, `conversions` and `subscriptions` tables, enables
   Row-Level Security, adds the signup trigger (auto-creates a profile + free subscription),
   and provisions a private `user-files` storage bucket.

### 1.2 Auth providers
**Authentication → Providers**:
- **Email** — enable (optionally turn on "Confirm email").
- **Google** — create OAuth credentials in Google Cloud Console; set the Authorized redirect URI to
  `https://<your-supabase-ref>.supabase.co/auth/v1/callback`.
- **GitHub** — create an OAuth App; Authorization callback URL is the same Supabase callback above.

**Authentication → URL Configuration** → add your site URLs to *Redirect URLs*:
```
http://localhost:3000/auth/callback
https://<your-frontend-domain>/auth/callback
```

### 1.3 Keys
| Key | Where it goes |
|-----|---------------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` (frontend) + `SUPABASE_URL` (backend) |
| `anon` public key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend) |
| `service_role` secret key | `SUPABASE_SERVICE_ROLE_KEY` (**backend only — never expose**) |

---

## 2. Environment variables

> **In production:** frontend values go in the **Vercel** dashboard (Environment
> Variables); backend values go in the **Hugging Face Space** (Settings → Variables
> and secrets). The `.env` files below are for **local development** only.

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=https://your-backend-domain
NEXT_PUBLIC_SITE_URL=https://your-frontend-domain
```
> `NEXT_PUBLIC_*` values are **baked at build time**. When building the Docker image, pass them as
> build args (the included Dockerfile and `render.yaml` already wire this up).

### Backend (`backend/.env`)
```
CORS_ORIGINS=https://your-frontend-domain
MAX_UPLOAD_MB=100
FILE_RETENTION_MINUTES=60
RATE_LIMIT_PER_MINUTE=60
APP_SECRET_KEY=<random-strong-secret>
STORAGE_DIR=/app/storage
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 3. Deploy: Hugging Face Spaces (backend) + Vercel (frontend) — recommended

The backend needs a real container (ffmpeg + tesseract + LibreOffice), so it goes
on **Hugging Face Spaces** (free tier = 16 GB RAM, no credit card). The Next.js
frontend goes on **Vercel**. Your single GitHub repo stays the source of truth.

### 3.1 Backend → Hugging Face Space (Docker)
1. **Create the Space:** huggingface.co → **New Space → SDK: Docker**. Note the `<user>/<space>`.
2. **Set env** in the Space → **Settings → Variables and secrets**:
   - **Secrets** (encrypted): `SUPABASE_SERVICE_ROLE_KEY`, `APP_SECRET_KEY`
   - **Variables**: `ENVIRONMENT=production`, `SUPABASE_URL=https://<ref>.supabase.co`,
     `MAX_UPLOAD_MB=1024` (optional `CORS_ORIGINS=<custom-domain>` — `*.vercel.app` is already allowed)
3. **Ship the code** (automated, single-repo):
   - Create an HF **write** token (huggingface.co → Settings → Access Tokens).
   - In GitHub: repo → **Settings → Secrets and variables → Actions** → add a secret `HF_TOKEN`.
   - Edit [`.github/workflows/deploy-hf.yml`](./.github/workflows/deploy-hf.yml) → set `HF_USERNAME` and `HF_SPACE`.
   - Push to `main` (or run the workflow manually). It pushes `backend/` to the Space, which builds (~10–20 min the first time).
   - **Manual alternative:** `git subtree push --prefix backend https://<user>:<token>@huggingface.co/spaces/<user>/<space>.git main`
4. **Backend URL:** `https://<user>-<space>.hf.space` — verify `…/api/health`.

### 3.2 Frontend → Vercel
1. Vercel → **New Project** → import the repo → **Root Directory = `frontend`**. (Vercel builds Next.js natively — the `frontend/Dockerfile` is ignored.)
2. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL` = `https://<user>-<space>.hf.space` (your HF backend URL)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = your Vercel URL
3. Deploy. (Changing any `NEXT_PUBLIC_*` later needs a **redeploy** — they're baked into the build.)

### 3.3 Connect them
- **CORS:** the backend already allows every `*.vercel.app` origin (production + previews) — no action needed. Add a custom domain to the backend's `CORS_ORIGINS` if you have one.
- **Supabase:** add your Vercel URL to **Authentication → URL Configuration → Redirect URLs** (`https://your-app.vercel.app/**`).

> **HF free tier notes:** 16 GB RAM (handles LibreOffice/video), **sleeps after ~48 h idle** (cold start on next request), and storage is **ephemeral** (fine — files auto-delete after 60 min). Keep secrets in HF **Secrets**; never commit `.env`.

---

## 4. Alternative: Render (backend)

The repo also ships a [`render.yaml`](./render.yaml) blueprint for the **backend** as a Docker
web service (free plan, no persistent disk).

1. Push this repo to GitHub.
2. Render: **New → Blueprint**, select the repo. Fill the `sync: false` secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
3. Point the frontend's `NEXT_PUBLIC_API_URL` at the backend's Render URL and redeploy.

> ⚠️ Render's **free** tier is 512 MB RAM — enough for PDF/image/OCR/audio, but
> **LibreOffice (Word/Excel/PPT) and video conversions will likely run out of memory**.
> Use Hugging Face (above) or a paid Render plan (≥ 2 GB) for those.

---

## 5. Deploy with Docker (any host)

```bash
# Backend
docker build -t aio-backend ./backend
docker run -d -p 8000:8000 --env-file backend/.env -v aio_storage:/app/storage aio-backend

# Frontend (pass NEXT_PUBLIC_* as build args)
docker build -t aio-frontend ./frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://your-backend-domain \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your-frontend-domain
docker run -d -p 3000:3000 aio-frontend
```

Or just `docker compose up --build` for both at once (see README).

---

## 6. Production hardening checklist

- [ ] Set a strong, unique `APP_SECRET_KEY`.
- [ ] Lock `CORS_ORIGINS` to your real frontend domain(s) only.
- [ ] Put the backend behind a CDN/WAF; keep `RATE_LIMIT_PER_MINUTE` sensible (or move the limiter to Redis for multi-instance).
- [ ] Wire the `scan_for_malware` hook (`backend/app/core/security.py`) to ClamAV / VirusTotal.
- [ ] Use a managed object store (e.g. Supabase Storage / S3) instead of local disk if you run multiple backend instances.
- [ ] Enable Supabase email confirmation and configure SMTP.
- [ ] Set realistic per-plan upload limits and enforce them server-side.
- [ ] Add monitoring/alerts on `/api/health` (it reports ffmpeg/tesseract/libreoffice availability).
- [ ] Run `npm run build` and `pytest` in CI before deploying.

---

## 7. Health & observability

- **Liveness:** `GET /api/health` → `{ status, version, capabilities: { ffmpeg, tesseract, libreoffice } }`
- **API docs:** `GET /docs` (Swagger) and `/redoc`
- **Sitemap:** `GET /sitemap.xml` · **Robots:** `GET /robots.txt`
