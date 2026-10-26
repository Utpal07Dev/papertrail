"""SQLAlchemy database connection and request-session dependency."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    """All SQLAlchemy table models inherit from this shared base class."""


# pool_pre_ping checks a pooled connection before using it. This prevents many
# confusing errors after a cloud database has closed an idle connection.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
)

# expire_on_commit=False lets a route serialize a newly committed Paper object
# without SQLAlchemy having to query it a second time.
SessionLocal = sessionmaker(
    bind=engine,
    class_=Session,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """Give one database session to a request and always close it afterward."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
