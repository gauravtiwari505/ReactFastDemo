from fastapi import APIRouter, HTTPException
from services.resume_service import get_saved_analysis_results

router = APIRouter()

@router.get("/get_analysis_results")
async def get_results(document_id: str):
    results = get_saved_analysis_results(document_id)
    if not results:
        raise HTTPException(status_code=404, detail="Analysis results not found.")
    return {"status": "success", "results": results}
