from fastapi import FastAPI
from routes.upload import router as upload_router
from routes.analyze import router as analyze_router
from routes.pdf import router as pdf_router

app = FastAPI()

# Include routes for each feature
app.include_router(upload_router)
app.include_router(analyze_router)
app.include_router(pdf_router)

@app.get("/")
def home():
    return {"message": "Welcome to the Resume Analysis API!"}
