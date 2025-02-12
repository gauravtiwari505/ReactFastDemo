from fastapi import APIRouter, HTTPException
from services.resume_service import analyze_resume
from pathlib import Path

router = APIRouter()
UPLOAD_DIR = Path("./tmp")

@router.post("/analyze_resume")
async def analyze(document_id: str):
    """
    Analyze the uploaded resume using the provided document ID.
    """
    file_path = UPLOAD_DIR / document_id
    
    # Check if the document exists
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document not found.")
    
    # Analyze the resume
    analysis_results = analyze_resume(document_id)
    
    return {"status": "success", "results": analysis_results}
