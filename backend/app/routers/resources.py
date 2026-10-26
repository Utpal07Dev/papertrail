"""Course resource routes.

POST /api/courses/{course_code}/resources  – attach a study link to a course
GET  /api/courses/{course_code}/resources  – list all resources for a course
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CourseResource
from app.schemas import ResourceCreate, ResourceResponse

router = APIRouter(
    prefix="/api/courses",
    tags=["resources"],
)


@router.post(
    "/{course_code}/resources",
    response_model=ResourceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Attach a study resource to a course",
)
def add_resource(
    course_code: str,
    body: ResourceCreate,
    db: Session = Depends(get_db),
) -> CourseResource:
    """Create and persist a new study resource tied to *course_code*.

    The description is required; the URL is optional (e.g. for notes that
    have no online link yet).
    """
    if not body.description.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="description must not be blank.",
        )

    resource = CourseResource(
        course_code=course_code.upper(),
        description=body.description.strip(),
        url=body.url.strip() if body.url else None,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


@router.get(
    "/{course_code}/resources",
    response_model=list[ResourceResponse],
    summary="List all study resources for a course",
)
def list_resources(
    course_code: str,
    db: Session = Depends(get_db),
) -> list[CourseResource]:
    """Return every resource for *course_code*, newest first.

    The lookup is case-insensitive so ``cse201`` and ``CSE201`` both work.
    """
    return (
        db.query(CourseResource)
        .filter(CourseResource.course_code == course_code.upper())
        .order_by(CourseResource.created_at.desc())
        .all()
    )
