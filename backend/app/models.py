from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    semester = Column(Integer, nullable=False)
    branch = Column(String(100), index=True, nullable=False)
    course_code = Column(String(50), index=True, nullable=False)
    exam_type = Column(String(100), nullable=False)
    file_url = Column(String(1000), nullable=False)
    file_hash = Column(String(64), unique=True, nullable=False)
    download_count = Column(Integer, default=0)
    
    # Community Moderation
    upvotes = Column(Integer, default=0)
    downvotes = Column(Integer, default=0)
    report_count = Column(Integer, default=0)

    reports = relationship("PaperReport", back_populates="paper", cascade="all, delete-orphan")


class PaperReport(Base):
    """A community report against a paper, with a reason."""

    __tablename__ = "paper_reports"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False, index=True)
    reason = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    paper = relationship("Paper", back_populates="reports")


class CourseResource(Base):
    """A study link (YouTube playlist, textbook URL, etc.) tied to a course_code."""

    __tablename__ = "course_resources"

    id = Column(Integer, primary_key=True, index=True)
    course_code = Column(String(50), index=True, nullable=False)
    description = Column(String(500), nullable=False)
    url = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
