
from fastapi import APIRouter, HTTPException
from typing import Dict, Any

router = APIRouter()
progress_store: Dict[str, Dict[str, Any]] = {}

def store_progress(document_id: str, stage: str, progress: float):
    progress_store[document_id] = {
        "currentStage": stage,
        "progress": progress,
        "isComplete": progress >= 100
    }

@router.get("/progress/{document_id}")
async def get_progress(document_id: str):
    if document_id not in progress_store:
        raise HTTPException(status_code=404, detail="Document not found")
    return progress_store[document_id]
