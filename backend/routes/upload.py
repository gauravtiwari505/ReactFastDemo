from fastapi import APIRouter, File, UploadFile
from pathlib import Path

router = APIRouter()
UPLOAD_DIR = Path("./tmp")

@router.post("/upload_resume")
async def upload_resume(file: UploadFile = File(...)):
    """
    Upload a resume and save it to the /tmp directory.
    Returns a document ID.
    """
    if not UPLOAD_DIR.exists():
        UPLOAD_DIR.mkdir(parents=True)
    
    # Save the uploaded file
    file_path = UPLOAD_DIR / file.filename
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    # Return the document ID (the file name)
    return {"status": "success", "document_id": file.filename}
