from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app import models, schemas
from app.database import get_db
from app.services import storage, ai_scanner
# Import the Supabase client directly here for the auto-delete feature
from supabase import create_client
from app.config import settings

router = APIRouter(prefix="/api/papers", tags=["papers"])

@router.post("", response_model=schemas.PaperResponse, status_code=201)
async def upload_paper(
    title: str = Form(...),
    semester: int = Form(...),
    branch: str = Form(...),
    course_code: str = Form(...),
    exam_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    temp_path, file_hash = await storage.hash_to_temporary_file(file)
    
    existing = db.query(models.Paper).filter(models.Paper.file_hash == file_hash).first()
    if existing:
        temp_path.unlink()
        raise HTTPException(status_code=409, detail="File already exists.")

    # Run Hybrid Scan
    scan_result = ai_scanner.scan_pdf(temp_path)
    if not scan_result.get("is_exam", False):
        temp_path.unlink()
        raise HTTPException(status_code=400, detail=f"Rejected: {scan_result.get('reason')}")

    file_url = storage.store_pdf(temp_path, file_hash)
    
    new_paper = models.Paper(
        title=title, semester=semester, branch=branch, course_code=course_code,
        exam_type=exam_type, file_url=file_url, file_hash=file_hash
    )
    db.add(new_paper)
    db.commit()
    db.refresh(new_paper)
    return new_paper

@router.get("", response_model=list[schemas.PaperResponse])
def search_papers(
    semester: int | None = None,
    branch: str | None = None,
    course_code: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.Paper)
    if semester is not None:
        query = query.filter(models.Paper.semester == semester)
    if branch:
        query = query.filter(models.Paper.branch.ilike(branch))
    if course_code:
        query = query.filter(models.Paper.course_code.ilike(f"%{course_code}%"))
    return query.offset(skip).limit(limit).all()

@router.post("/{paper_id}/vote", response_model=schemas.PaperResponse)
def vote_paper(paper_id: int, vote: schemas.PaperVote, db: Session = Depends(get_db)):
    paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    if vote.vote_type == "up":
        paper.upvotes += 1
    elif vote.vote_type == "down":
        paper.downvotes += 1

    # Auto-delete threshold
    if paper.downvotes >= 100:
        # Delete from Supabase Storage
        supabase = create_client(settings.supabase_url, settings.supabase_key)
        supabase.storage.from_("past_papers").remove([f"{paper.file_hash}.pdf"])
        
        # Delete from Database
        db.delete(paper)
        db.commit()
        raise HTTPException(status_code=200, detail="Paper automatically removed due to community downvotes.")

    db.commit()
    db.refresh(paper)
    return paper