# PaperVault — University Past Paper Repository

A complete lab-project application for uploading, finding, and downloading university examination papers. The backend is **FastAPI + PostgreSQL + SQLAlchemy 2**, while the browser UI uses **HTML + Vanilla JavaScript + Tailwind CSS via CDN**.

The project is deliberately modular and heavily commented so a third-semester CS student can follow the request flow from an HTML form, through `fetch()`, into a FastAPI route, and finally into PostgreSQL.

## Features

- Upload a PDF with title, semester, branch, course code, and exam type.
- Stream files in chunks and calculate a SHA-256 fingerprint without loading the whole PDF into memory.
- Reject duplicate file content with both an early check and a database `UNIQUE` constraint.
- Validate the extension, browser MIME type, PDF byte signature, and maximum size.
- Search by semester, exact case-insensitive branch, and partial case-insensitive course code.
- Example: `cse201` matches the stored value `19CSE201`.
- Atomically increment `download_count` before returning a file URL.
- Responsive, accessible frontend with loading, empty, success, and error states.
- CORS configuration for a separately served local or hosted frontend.
- API docs at `/docs`, a database-aware health endpoint, Docker support, and a Render Blueprint.

## Folder structure

```text
.
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   └── papers.py       # Upload, search, and download routes
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   └── storage.py      # Streaming hash + storage adapter point
│   │   ├── __init__.py
│   │   ├── config.py           # Environment variables
│   │   ├── database.py         # Engine, session, and get_db dependency
│   │   ├── main.py             # FastAPI app, CORS, mounts, health check
│   │   ├── models.py           # SQLAlchemy Paper model
│   │   └── schemas.py          # Pydantic response models
│   ├── uploads/
│   │   └── .gitkeep
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── index.html              # Tailwind CDN interface
│   └── app.js                  # fetch(), FormData, rendering, downloads
├── .dockerignore
├── .gitignore
├── Dockerfile                  # Production image serving API + frontend
├── docker-compose.yml          # App + PostgreSQL + persistent volumes
├── render.yaml                 # Render web service, database, and disk
└── README.md
```

> The repository may also contain a small `src/` Next.js host scaffold used only by the online coding preview. The requested application is entirely inside `backend/` and `frontend/` and does not depend on Next.js.

## How the frontend and backend communicate

1. The browser reads form values from `frontend/index.html`.
2. `frontend/app.js` creates `new FormData(uploadForm)`. This includes normal text fields and the binary PDF.
3. `fetch(".../api/papers", { method: "POST", body: formData })` sends a multipart HTTP request. The browser creates the multipart boundary automatically, so JavaScript must **not** set `Content-Type` manually.
4. FastAPI parses fields with `Form(...)` and the PDF with `UploadFile`.
5. The storage service reads one MiB at a time, computes SHA-256, and writes a temporary file.
6. SQLAlchemy queries PostgreSQL for that hash. A duplicate returns HTTP `409 Conflict`; otherwise the PDF and row are saved.
7. FastAPI serializes the `Paper` through a Pydantic response model and returns JSON.
8. JavaScript reads the JSON, shows a toast, and refreshes the paper list.

The search flow is a normal GET request. JavaScript creates query parameters such as:

```text
/api/papers?semester=3&branch=CSE&course_code=cse201
```

For downloads, JavaScript first requests `/api/papers/{id}/download`. PostgreSQL increments the count atomically, the API returns `file_url`, and only then does the browser open the PDF.

## Database schema

The `papers` table contains:

| Column | Type | Notes |
|---|---|---|
| `id` | integer | Primary key |
| `title` | varchar(255) | Required |
| `semester` | integer | Required, checked from 1 through 12 |
| `branch` | varchar(100) | Indexed |
| `course_code` | varchar(50) | Indexed |
| `exam_type` | varchar(100) | Required |
| `file_url` | varchar(1000) | Local or cloud URL |
| `file_hash` | varchar(64) | SHA-256, unique |
| `download_count` | integer | Defaults to 0, cannot be negative |

For this lab, `Base.metadata.create_all()` creates missing tables when FastAPI starts. It does not remove existing data. In a larger team project, use Alembic migrations for schema changes.

---

# Run locally

## Option A — Docker Compose (recommended and easiest)

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/), then run from the repository root:

```bash
docker compose up --build
```

Open:

- Application: <http://localhost:8000>
- Swagger API docs: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/api/health>

Docker starts PostgreSQL, waits until it is healthy, then starts FastAPI. Named volumes preserve database rows and uploaded PDFs across restarts.

Stop containers:

```bash
docker compose down
```

Stop and delete all local project data:

```bash
docker compose down -v
```

## Option B — Native Python and PostgreSQL

### 1. Prerequisites

- Python 3.11 or newer
- PostgreSQL 14 or newer (only if using a local database)
- A terminal

### 2. Choose a database

If using the hosted Supabase database, skip the local database creation below.
The connection URL is already set in `.env.example`; add your database
password as described in step 4.

For local PostgreSQL only, create the database with:

Using PostgreSQL's command-line client:

```bash
psql -U postgres -c "CREATE DATABASE past_papers;"
```

If it already exists, PostgreSQL reports an error that can be safely ignored.

### 3. Create and activate a virtual environment

From the repository root:

```bash
cd backend
python -m venv .venv
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

### 4. Install dependencies and configure environment values

```bash
pip install -r requirements.txt
```

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The example is prefilled for the project's Supabase database. Replace
`YOUR_PASSWORD` with your Supabase database password. URL-encode special
characters in the password (for example, `@` as `%40`). Keep this password
private and do not commit `.env`.

For another PostgreSQL database, set `DATABASE_URL` to its connection string.
A SQLAlchemy Psycopg URL looks like:

```text
postgresql+psycopg://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

### Using Supabase with Docker Compose

Docker Compose reads a `.env` file in the repository root for variable
substitution. Create one with the hosted database URL, using the same password
and URL-encoding guidance above:

```text
DATABASE_URL=postgresql://postgres.nwfvvlnfzrupazeruovk:YOUR_PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

Then run `docker compose up --build`. If `DATABASE_URL` is not set, Compose
uses the local PostgreSQL container. When `DATABASE_URL` is set, the app uses
that hosted database; Compose still starts its local PostgreSQL service because
it is configured as a dependency.

### 5. Start FastAPI

Still inside `backend/`:

```bash
uvicorn app.main:app --reload
```

Open <http://localhost:8000>. FastAPI serves both the API and the sibling `frontend/` folder, so a second server is not required.

### Optional: serve the frontend separately

This demonstrates why CORS is present. Keep FastAPI on port 8000, open a second terminal at the repository root, and run:

```bash
python -m http.server 5500 --directory frontend
```

Then visit <http://localhost:5500>. `app.js` recognizes common local frontend ports and calls `http://localhost:8000/api`.

Do not double-click `index.html` and use a `file://` URL; browser origin rules and module/security behavior are more predictable through a tiny local HTTP server.

---

# API reference

## Upload a paper

```http
POST /api/papers
Content-Type: multipart/form-data
```

Fields: `title`, `semester`, `branch`, `course_code`, `exam_type`, and `file`.

Example with cURL:

```bash
curl -X POST http://localhost:8000/api/papers \
  -F "title=Data Structures Final 2024" \
  -F "semester=3" \
  -F "branch=CSE" \
  -F "course_code=19CSE201" \
  -F "exam_type=Final" \
  -F "file=@./sample-paper.pdf;type=application/pdf"
```

Important responses:

- `201 Created` — paper saved.
- `400 Bad Request` — file is not a real PDF or exceeds the size limit.
- `409 Conflict` — identical file bytes already exist.
- `415 Unsupported Media Type` — filename/type is not PDF.
- `422 Unprocessable Entity` — a form field failed validation.

## Search papers

```bash
curl "http://localhost:8000/api/papers?semester=3&branch=CSE&course_code=cse201"
```

All filters are optional. `skip` and `limit` are also supported; `limit` is capped at 100.

## Track a download

```bash
curl http://localhost:8000/api/papers/1/download
```

Example response:

```json
{
  "id": 1,
  "file_url": "/uploads/sha256-value.pdf",
  "download_count": 4
}
```

---

# Deployment recommendations

## Best simple choice: Render (one service)

This repository includes `render.yaml`. A single Docker web service hosts both the FastAPI API and static frontend, a managed PostgreSQL database stores metadata, and a persistent disk stores local PDFs.

1. Push this repository to GitHub or GitLab.
2. Create a Render account at <https://render.com>.
3. Choose **New → Blueprint** and select the repository.
4. Review the resources detected from `render.yaml` and deploy.
5. Render injects its PostgreSQL connection string as `DATABASE_URL`. `config.py` converts common provider URL formats to the installed Psycopg 3 driver.
6. Change `ALLOWED_ORIGINS` to the exact generated site URL if it differs from `https://papervault.onrender.com`.
7. Keep `UPLOAD_DIR=/var/data/uploads`; `/var/data` is the persistent disk mount.
8. Test `/api/health`, `/docs`, upload, search, and download after deployment.

Persistent disks and managed databases may require a paid Render plan. Never rely on the container's ordinary filesystem in production: it is replaced during deploys and restarts.

## Good alternative: Railway

1. Create a Railway project from the GitHub repository.
2. Add a PostgreSQL service.
3. Deploy the repository using its root `Dockerfile`.
4. Set `DATABASE_URL` from the PostgreSQL service reference.
5. Add a volume mounted at `/data` and set `UPLOAD_DIR=/data/uploads`.
6. Set `ALLOWED_ORIGINS` to the public Railway domain and optionally set `PUBLIC_BASE_URL` to that same HTTPS origin.
7. Set the health-check path to `/api/health`.

Railway supplies `PORT`, which the Docker command already reads.

## Separate frontend hosting: Cloudflare Pages, Netlify, or GitHub Pages

A static frontend can be hosted separately while Render/Railway hosts FastAPI:

1. Deploy the `frontend/` directory as the static publish directory.
2. In `frontend/index.html`, set the meta tag:

   ```html
   <meta name="api-base-url" content="https://your-api.example.com/api" />
   ```

3. Add the exact static-site origin to backend `ALLOWED_ORIGINS`, for example:

   ```text
   ALLOWED_ORIGINS=https://your-site.pages.dev
   ```

4. Redeploy both services and check the browser developer console for CORS errors.

## Recommended real production storage

Local storage is included because it is understandable and works well in a lab. At larger scale, use object storage such as:

- Amazon S3
- Cloudflare R2
- Supabase Storage
- Google Cloud Storage

The replacement point is `store_pdf()` in `backend/app/services/storage.py`. Upload the verified temporary path with the provider SDK, delete the temporary file, and return the object's HTTPS URL. The database, routers, and frontend can remain unchanged.

---

# Security and production notes

- Secrets belong in environment variables, never Git. `.env` is ignored.
- SHA-256 identifies duplicate content; it is not malware scanning. A public upload system should also add authentication, authorization, rate limits, moderation, and antivirus scanning.
- The PDF byte signature check catches obvious renamed files but is not a complete file parser.
- CORS is not authentication. It only tells browsers which frontend origins may call the API.
- File size is checked in both the frontend for quick feedback and the backend for actual security.
- The download count uses one SQL `UPDATE ... RETURNING` expression, avoiding lost increments under concurrent requests.
- Tailwind's CDN build is used because the project brief explicitly asks for it. For a high-traffic public deployment, compile Tailwind into a minified static CSS file.
- Use HTTPS in production; Render, Railway, Netlify, and Cloudflare Pages provide managed TLS.
- Configure PostgreSQL backups and object-storage retention before accepting important files.

# Troubleshooting

### `connection refused` or health check fails

Confirm PostgreSQL is running and `DATABASE_URL` has the correct host/port. Inside Docker Compose, the host is `database`; outside Docker, it is normally `127.0.0.1`.

### Browser shows `API offline`

Open <http://localhost:8000/api/health>. If the frontend is separate, ensure FastAPI is running on port 8000 and the frontend origin is listed in `ALLOWED_ORIGINS`.

### Duplicate upload returns 409

That is expected. Hashing file bytes means renaming an existing PDF does not bypass duplicate detection.

### Uploaded PDFs disappear after cloud redeployment

The service does not have persistent storage. Attach a disk/volume and set `UPLOAD_DIR`, or replace local storage with an object-store SDK.

### Port 5432 is already in use

Stop the other PostgreSQL instance, or change the host-side Compose port from `5432:5432` to `5433:5432`. The app container still connects to `database:5432`.

# Suggested student exercises

1. Add user accounts and restrict uploading to authenticated users.
2. Add department and academic-year tables with foreign keys.
3. Add pagination controls that use `skip` and `limit`.
4. Add Alembic and create the first migration.
5. Replace local storage with an S3-compatible service.
6. Add tests with Pytest, FastAPI `TestClient`, and a separate test database.
7. Add admin approval before a paper becomes publicly searchable.

You can inspect every request interactively at <http://localhost:8000/docs> while learning.
