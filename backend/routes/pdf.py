from fastapi import APIRouter
from services.pdf_service import generate_pdf

router = APIRouter()

@router.post("/generate_pdf_report")
async def generate_report(document_id: str):
    pdf_path = generate_pdf(document_id)
    return {"status": "success", "pdf_url": f"/static/{pdf_path}"}
