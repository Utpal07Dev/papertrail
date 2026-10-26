# syntax=docker/dockerfile:1
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app/backend

WORKDIR /app

# Installing dependencies before copying source keeps this layer cacheable.
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --upgrade pip && pip install -r /app/backend/requirements.txt

COPY backend /app/backend
COPY frontend /app/frontend

# The API does not need root privileges. The upload folder remains writable.
RUN adduser --disabled-password --gecos "" appuser \
    && mkdir -p /app/backend/uploads \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
WORKDIR /app/backend

# Render/Railway provide PORT. The default keeps ordinary Docker use simple.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WEB_CONCURRENCY:-2}"]
