"""FastAPI application entry point.

Start locally from the backend directory with:
    uvicorn app.main:app --reload
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.config import settings
from app.database import Base, engine
from app.routers.papers import router as papers_router
from app.routers.resources import router as resources_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Prepare folders/tables at startup and release connections at shutdown.

    create_all is convenient for this lab project and only creates missing
    tables; it never deletes existing data. Teams with evolving production
    schemas should replace this line with Alembic migrations.
    """

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    yield
    engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "Upload, find, and track downloads of university examination papers. "
        "Use /docs for the interactive API explorer."
    ),
    lifespan=lifespan,
)

# CORS allows browser JavaScript served from a different local port/domain to
# call this API. Production frontend domains belong in ALLOWED_ORIGINS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)

app.include_router(papers_router)
app.include_router(resources_router)


@app.get("/api/health", tags=["system"])
def health_check() -> JSONResponse:
    """Verify that both the API process and PostgreSQL are responding."""

    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return JSONResponse({"status": "ok", "service": settings.app_name})


# Uploaded PDFs are available at /uploads/<sha256>.pdf during local use.
app.mount(
    "/uploads",
    StaticFiles(directory=str(settings.upload_dir)),
    name="uploads",
)

# Serving the static frontend here makes one-service deployment possible.
# API routes are registered first, so this final catch-all mount cannot hide
# /api, /docs, /openapi.json, or /uploads.
frontend_directory = Path(__file__).resolve().parents[2] / "frontend"
if frontend_directory.exists():
    app.mount(
        "/",
        StaticFiles(directory=str(frontend_directory), html=True),
        name="frontend",
    )
