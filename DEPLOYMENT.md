# Deployment Guide — All in one convertor

This guide covers Supabase setup, environment variables, and deploying to **Render**
(blueprint included) or any Docker host.

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

## 3. Deploy to Render (recommended)

The repo ships a [`render.yaml`](./render.yaml) blueprint that creates **two Docker web services**.

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, select the repo. Render reads `render.yaml`.
3. Fill in the `sync: false` secrets when prompted:
   - Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - Frontend: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. After the first deploy, update the cross-references:
   - Backend `CORS_ORIGINS` → the frontend's Render URL
   - Frontend `NEXT_PUBLIC_API_URL` → the backend's Render URL
   Then trigger a redeploy of the frontend (so the new API URL is baked in).
5. Add both Render URLs (`/auth/callback`) to the Supabase redirect allow-list.

> The backend service mounts a 5 GB persistent disk at `/app/storage` for in-flight files,
> which are auto-deleted after `FILE_RETENTION_MINUTES`.

---

## 4. Deploy with Docker (any host)

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

## 5. Production hardening checklist

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

## 6. Health & observability

- **Liveness:** `GET /api/health` → `{ status, version, capabilities: { ffmpeg, tesseract, libreoffice } }`
- **API docs:** `GET /docs` (Swagger) and `/redoc`
- **Sitemap:** `GET /sitemap.xml` · **Robots:** `GET /robots.txt`
