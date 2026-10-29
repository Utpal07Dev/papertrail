import fitz
import json
import re
import traceback
from pathlib import Path
from google import genai
from google.genai import types
from app.config import settings

client = genai.Client(api_key=settings.gemini_api_key)

# Flexible exam and academic keywords
EXAM_KEYWORDS = [
    "midterm", "mid-term", "mid term", "final", "examination", "exam",
    "semester", "sem", "subject", "assignment", "test", "quiz",
    "marks", "maximum marks", "max marks", "time allowed", "duration",
    "course", "department", "instructions", "roll no", "reg no"
]

def scan_pdf(file_path: Path) -> dict:
    """Hybrid scan: Fast local lexical check first, fallback to Gemini 3.8 Flash for scanned images."""
    try:
        text = ""
        # 1. Fast Local Check using PyMuPDF (First 2 pages)
        with fitz.open(file_path) as doc:
            pages_to_check = min(2, len(doc))
            for i in range(pages_to_check):
                text += doc[i].get_text().lower() + " "
        
        # 2. Smart Lexical Validation
        if text.strip():
            # Matches formats like CS101, MATH201, or 22MAT122
            has_course_code = bool(re.search(r'\b(?:[a-z]{2,4}\s*\d{2,4}|\d{2}[a-z]{2,4}\d{2,4})\b', text))
            # Matches formats like Q1, Question 2, or numbered question list "1. Expand..."
            has_questions = bool(re.search(r'(?:q(?:uestion)?\.?\s*\d+|\b\d+\.\s+[a-z])', text))
            
            matches = [kw for kw in EXAM_KEYWORDS if kw in text]
            match_count = len(matches)
            
            # Accept if at least 2 keywords match, or 1 keyword with course code / questions
            if match_count >= 2 or (match_count >= 1 and (has_course_code or has_questions)):
                return {
                    "is_exam": True, 
                    "reason": f"Fast lexical match ({match_count} keywords: {', '.join(matches[:3])})"
                }

        # 3. Fallback to Gemini 3.8 Flash (For image scans, photos, or ambiguous text)
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
        Return a JSON object with:
        {"is_exam": true, "reason": "short explanation"}
        """
        
        response = client.models.generate_content(
            model='gemini-3.8-flash',
            contents=[gemini_file, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        # Clean up the file from Google's servers to prevent storage clutter
        client.files.delete(name=gemini_file.name)
        
        # Parse the JSON response defensively
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text.replace("```json", "", 1).rstrip("`").strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text.replace("```", "", 1).rstrip("`").strip()
            
        return json.loads(raw_text)
        
    except Exception as e:
        traceback.print_exc() # Prints the full error log to your Uvicorn terminal
        return {"is_exam": False, "reason": f"Hybrid Scanner failed: {repr(e)}"}
