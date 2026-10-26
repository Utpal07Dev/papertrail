"""PDF hashing and storage helpers.

Replaced local storage with Supabase object storage.
"""

import hashlib
import os
import tempfile
from pathlib import Path

from fastapi import UploadFile
from supabase import create_client, Client

from app.config import settings

CHUNK_SIZE = 1024 * 1024  # Read one MiB at a time; large files never fill RAM.


class FileTooLargeError(ValueError):
    """Raised when an upload exceeds MAX_UPLOAD_SIZE_MB."""


class InvalidPdfError(ValueError):
    """Raised when file contents do not have a PDF signature."""


async def hash_to_temporary_file(upload: UploadFile) -> tuple[Path, str]:
    """Stream an upload to a temporary file and calculate its SHA-256 hash."""
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(
        prefix="paper-",
        suffix=".upload",
        dir=settings.upload_dir,
    )
    temporary_path = Path(temporary_name)
    hasher = hashlib.sha256()
    total_bytes = 0
    max_bytes = settings.max_upload_size_mb * 1024 * 1024

    try:
        with os.fdopen(file_descriptor, "wb") as temporary_file:
            while chunk := await upload.read(CHUNK_SIZE):
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    raise FileTooLargeError(
                        f"PDFs may not exceed {settings.max_upload_size_mb} MB."
                    )
                hasher.update(chunk)
                temporary_file.write(chunk)

        with temporary_path.open("rb") as saved_file:
            if saved_file.read(5) != b"%PDF-":
                raise InvalidPdfError("The uploaded file is not a valid PDF.")

        return temporary_path, hasher.hexdigest()
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise
    finally:
        await upload.close()


def store_pdf(temporary_path: Path, file_hash: str) -> str:
    """Move a verified PDF into Supabase Storage and return its public URL."""
    # Initialize the Supabase client using credentials from your config
    supabase: Client = create_client(settings.supabase_url, settings.supabase_key)
    
    file_name = f"{file_hash}.pdf"
    bucket_name = "past_papers" 
    
    try:
        # Upload the temporary file bytes to the Supabase bucket
        with open(temporary_path, "rb") as f:
            supabase.storage.from_(bucket_name).upload(
                path=file_name,
                file=f,
                file_options={"content-type": "application/pdf"}
            )
            
        # Retrieve and return the permanent, public HTTPS URL
        return supabase.storage.from_(bucket_name).get_public_url(file_name)
    finally:
        # Always wipe the temporary file off Render's local disk
        temporary_path.unlink(missing_ok=True)