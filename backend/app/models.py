from sqlalchemy import Column, Integer, String
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