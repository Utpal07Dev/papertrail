# 📄 PaperTrail — University Past Paper Repository

> A full-stack web application for uploading, searching, and downloading university examination papers.

![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=flat&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat&logo=docker&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)

---

## 📖 Overview

**PaperTrail** is a modular, heavily-commented lab project designed with educational clarity in mind. It allows students to:

- **Upload** PDF examination papers with metadata (title, semester, branch, course code, exam type)
- **Search** papers by semester, branch, and course code (partial, case-insensitive)
- **Download** papers with atomic download-count tracking

The backend is built with **FastAPI + PostgreSQL + SQLAlchemy 2**, and the frontend uses **HTML + Vanilla JavaScript + Tailwind CSS (CDN)**.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📤 PDF Upload | Streams files in chunks with SHA-256 duplicate detection |
| 🔍 Smart Search | Case-insensitive, partial course code matching (e.g. `cse201` matches `19CSE201`) |
| 📥 Download Tracking | Atomically increments `download_count` on each download |
| 🛡️ Validation | Checks extension, MIME type, PDF byte signature, and file size |
| 🔁 Duplicate Detection | Rejects identical file bytes via SHA-256 hash + `UNIQUE` DB constraint |
| 🌐 CORS Configured | Supports separately hosted frontends |
| 🐳 Docker Ready | Full Docker Compose setup with PostgreSQL and persistent volumes |
| 📑 API Docs | Interactive Swagger UI at `/docs` |
| ❤️ Health Endpoint | DB-aware health check at `/api/health` |

---

## 🗂️ Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   └── papers.py        # Upload, search, and download routes
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   └── storage.py       # Streaming hash + storage adapter
│   │   ├── __init__.py
│   │   ├── config.py            # Environment variable settings
│   │   ├── database.py          # Engine, session, and get_db dependency
│   │   ├── main.py              # FastAPI app, CORS, mounts, health check
│   │   ├── models.py            # SQLAlchemy Paper model
│   │   └── schemas.py           # Pydantic response models
│   ├── uploads/
│   │   └── .gitkeep
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── index.html               # Tailwind CDN interface
│   └── app.js                   # fetch(), FormData, rendering, downloads
├── .dockerignore
├── .gitignore
├── Dockerfile                   # Production image serving API + frontend
├── docker-compose.yml           # App + PostgreSQL + persistent volumes
├── render.yaml                  # Render web service, database, and disk
└── README.md
```

---

## 🗄️ Database Schema

The `papers` table:

| Column | Type | Notes |
|---|---|---|
| `id` | integer | Primary key |
| `title` | varchar(255) | Required |
| `semester` | integer | Required, 1–12 |
| `branch` | varchar(100) | Indexed |
| `course_code` | varchar(50) | Indexed |
| `exam_type` | varchar(100) | Required |
| `file_url` | varchar(1000) | Local or cloud URL |
| `file_hash` | varchar(64) | SHA-256, unique |
| `download_count` | integer | Defaults to 0 |

> Tables are auto-created on startup via `Base.metadata.create_all()`. Use Alembic for schema changes in team projects.

---

## 🚀 Getting Started

### Option A — Docker Compose *(Recommended)*

```bash
docker compose up --build
```

Then open:
- **App**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Health**: http://localhost:8000/api/health

```bash
# Stop containers
docker compose down

# Stop and delete all data (volumes)
docker compose down -v
```

---

### Option B — Native Python + PostgreSQL

#### 1. Prerequisites

- Python 3.11+
- PostgreSQL 14+

#### 2. Create the database *(local PostgreSQL only)*

```bash
psql -U postgres -c "CREATE DATABASE past_papers;"
```

Skip this step if using Supabase.

#### 3. Create a virtual environment

```bash
cd backend
python -m venv .venv
```

**macOS/Linux:**
```bash
source .venv/bin/activate
```

**Windows PowerShell:**
```powershell
.venv\Scripts\Activate.ps1
```

#### 4. Install dependencies

```bash
pip install -r requirements.txt
```

#### 5. Configure environment

**macOS/Linux:**
```bash
cp .env.example .env
```

**Windows PowerShell:**
```powershell
Copy-Item .env.example .env
```

Edit `.env` and replace `YOUR_PASSWORD` with your database password. URL-encode special characters (e.g. `@` → `%40`).

A SQLAlchemy connection string looks like:
```
postgresql+psycopg://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

#### 6. Start the server

```bash
uvicorn app.main:app --reload
```

Open http://localhost:8000 — FastAPI serves both the API and the `frontend/` folder.

#### Optional: Serve the frontend separately

```bash
python -m http.server 5500 --directory frontend
```

Then visit http://localhost:5500. `app.js` auto-detects local frontend ports and calls `http://localhost:8000/api`.

---

## 🔌 API Reference

### Upload a paper

```http
POST /api/papers
Content-Type: multipart/form-data
```

**Fields:** `title`, `semester`, `branch`, `course_code`, `exam_type`, `file`

```bash
curl -X POST http://localhost:8000/api/papers \
  -F "title=Data Structures Final 2024" \
  -F "semester=3" \
  -F "branch=CSE" \
  -F "course_code=19CSE201" \
  -F "exam_type=Final" \
  -F "file=@./sample-paper.pdf;type=application/pdf"
```

| Status | Meaning |
|---|---|
| `201 Created` | Paper saved |
| `400 Bad Request` | Not a real PDF or exceeds size limit |
| `409 Conflict` | Identical file already uploaded |
| `415 Unsupported Media Type` | Not a PDF |
| `422 Unprocessable Entity` | Form field validation failed |

---

### Search papers

```bash
curl "http://localhost:8000/api/papers?semester=3&branch=CSE&course_code=cse201"
```

All filters are optional. `skip` and `limit` are supported (`limit` capped at 100).

---

### Track a download

```bash
curl http://localhost:8000/api/papers/1/download
```

```json
{
  "id": 1,
  "file_url": "/uploads/sha256-value.pdf",
  "download_count": 4
}
```

---

## ☁️ Deployment

### Render *(Easiest)*

1. Push repository to GitHub/GitLab
2. Create account at https://render.com
3. **New → Blueprint** → select the repo
4. Render auto-detects `render.yaml` and deploys everything
5. Update `ALLOWED_ORIGINS` to your generated site URL if needed

### Railway

1. Create a Railway project from the GitHub repo
2. Add a PostgreSQL service and link `DATABASE_URL`
3. Deploy using the root `Dockerfile`
4. Mount a volume at `/data` and set `UPLOAD_DIR=/data/uploads`
5. Set the health-check path to `/api/health`

### Separate Frontend Hosting *(Cloudflare Pages, Netlify, GitHub Pages)*

1. Deploy `frontend/` as the static publish directory
2. Set the API base URL in `frontend/index.html`:
   ```html
   <meta name="api-base-url" content="https://your-api.example.com/api" />
   ```
3. Add the frontend origin to backend `ALLOWED_ORIGINS`

> **For large-scale production**, replace local PDF storage with object storage (Amazon S3, Cloudflare R2, Supabase Storage, GCS). The only change needed is in `backend/app/services/storage.py` → `store_pdf()`.

---

## 🔒 Security Notes

- Secrets go in environment variables — **never commit `.env`**
- SHA-256 detects duplicates; it is **not** a malware scanner
- CORS is not authentication — add auth, rate limits, and moderation for public deployments
- The PDF byte-signature check is a basic sanity check, not a full parser
- Download count uses a single `UPDATE ... RETURNING` to avoid race conditions
- Use HTTPS in production (Render, Railway, Cloudflare Pages all provide managed TLS)

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---|---|
| `connection refused` / health check fails | Confirm PostgreSQL is running and `DATABASE_URL` is correct. Docker Compose host is `database`; native host is `127.0.0.1` |
| Browser shows `API offline` | Open http://localhost:8000/api/health; ensure FastAPI is running and CORS is configured |
| Upload returns `409 Conflict` | Expected — the same PDF bytes already exist (SHA-256 duplicate detection) |
| Uploaded PDFs disappear after redeploy | Attach a persistent disk/volume or use object storage |
| Port `5432` already in use | Stop other PostgreSQL, or change Compose host port to `5433:5432` |

---

## 💡 Student Exercises

1. Add user accounts and restrict uploads to authenticated users
2. Add department and academic-year tables with foreign keys
3. Build pagination UI using `skip` and `limit`
4. Set up Alembic and write the first migration
5. Replace local storage with an S3-compatible service
6. Write tests with `pytest`, FastAPI `TestClient`, and a separate test database
7. Add admin approval before a paper becomes publicly searchable

Explore every route interactively at http://localhost:8000/docs while learning.

---

## 📄 License

This project is intended for educational use as a university lab project.
