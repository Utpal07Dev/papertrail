from datetime import datetime

from pydantic import BaseModel, ConfigDict

class PaperCreate(BaseModel):
    title: str
    semester: int
    branch: str
    course_code: str
    exam_type: str

class PaperResponse(BaseModel):
    id: int
    title: str
    semester: int
    branch: str
    course_code: str
    exam_type: str
    file_url: str
    download_count: int
    upvotes: int
    downvotes: int

    model_config = ConfigDict(from_attributes=True)

class PaperVote(BaseModel):
    vote_type: str  # "up" or "down"


# ── Course Resources ────────────────────────────────────────────────────────

class ResourceCreate(BaseModel):
    """Fields accepted when adding a new study resource."""

    description: str
    url: str | None = None


class ResourceResponse(BaseModel):
    """Fields returned for a study resource (ORM-friendly)."""

    id: int
    course_code: str
    description: str
    url: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)