import fitz
import json
import traceback
from pathlib import Path
from google import genai
from app.config import settings

client = genai.Client(api_key=settings.gemini_api_key)

# Fast lexical keywords
EXAM_KEYWORDS = [
    "midterm", "final", "examination", "subject", "semester",
    "course code", "marks", "time allowed", "questions", "assignment", "test", "quiz"
]

def scan_pdf(file_path: Path) -> dict:
    """Hybrid scan: Fast local lexical check first, fallback to Gemini API for images or complex files."""
    try:
        text = ""
        # 1. Fast Local Check using PyMuPDF
        with fitz.open(file_path) as doc:
            # Safely iterate through up to the first 2 pages
            pages_to_check = min(2, len(doc))
            for i in range(pages_to_check):
                text += doc[i].get_text().lower()
        
        # If we successfully extracted digital text, check for keywords
        if text.strip():
            match_count = sum(1 for word in EXAM_KEYWORDS if word in text)
            if match_count >= 3:
                return {"is_exam": True, "reason": f"Fast lexical match ({match_count} keywords found)"}

        # 2. Fallback to Gemini (For scanned images, photos, or ambiguous text)
        print("Lexical check inconclusive. Falling back to Gemini API for OCR...")
        
        # Upload the file to Gemini (handles both text PDFs and image-based PDFs natively)
        gemini_file = client.files.upload(
            file=str(file_path),
            config={'mime_type': 'application/pdf'}
        )
        
        prompt = """
        Analyze this document. Is it a university examination past paper, test, quiz, or academic assignment?
        Look for indicators like Midterm, Final, Examination, Assignment, Quiz, Semester, Course Code, Marks, Time Allowed, Instructions, or numbered questions.
        Even if it is a scanned photograph, read the text carefully.
        Return ONLY a raw JSON object with no markdown formatting:
        {"is_exam": true, "reason": "short explanation"}
        """
        
        response = client.models.generate_content(
            model='gemini-3.8-flash',
            contents=[gemini_file, prompt]
        )
        
        # Clean up the file from Google's servers to prevent storage clutter
        client.files.delete(name=gemini_file.name)
        
        # Parse the JSON response
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text.replace("```json", "").replace("```", "").strip()
            
        return json.loads(raw_text)
        
    except Exception as e:
        traceback.print_exc() # Prints the full error log to your Uvicorn terminal
        return {"is_exam": False, "reason": f"Hybrid Scanner failed: {repr(e)}"}
