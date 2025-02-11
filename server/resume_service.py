import sys
import json
import base64
from pathlib import Path
import os
from pdfminer.high_level import extract_text

TMP_DIR = Path("./tmp")
os.makedirs(TMP_DIR, exist_ok=True)

def log_info(msg: str):
    """Log information to stderr"""
    print(msg, file=sys.stderr, flush=True)

def log_error(msg: str):
    """Log errors to stderr"""
    print(f"Error: {msg}", file=sys.stderr, flush=True)

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from PDF."""
    try:
        text = extract_text(pdf_path)
        if not text.strip():
            raise ValueError("No text content extracted from PDF")
        return text
    except Exception as e:
        log_error(f"PDF extraction error: {str(e)}")
        raise ValueError(f"Failed to extract text from PDF: {str(e)}")

def analyze_resume(file_bytes: bytes, filename: str) -> dict:
    """Process and analyze a resume."""
    log_info("Starting resume analysis...")

    # Save uploaded file
    temp_file_path = os.path.join(TMP_DIR, filename)
    with open(temp_file_path, "wb") as temp_file:
        temp_file.write(file_bytes)

    try:
        # Extract text from PDF
        full_text = extract_text_from_pdf(temp_file_path)
        log_info(f"Successfully extracted {len(full_text)} characters of text")

        # Mock analysis for now - we'll enhance this later
        mock_sections = [
            {
                "name": "Summary",
                "score": 85,
                "content": "Professional summary is clear and concise",
                "suggestions": ["Add more specific achievements"]
            },
            {
                "name": "Experience",
                "score": 90,
                "content": "Work experience is well detailed",
                "suggestions": ["Use more action verbs"]
            }
        ]

        results = {
            "overview": "The resume is well-structured and presents qualifications effectively.",
            "strengths": [
                "Clear presentation of experience",
                "Good use of formatting",
                "Relevant skills highlighted"
            ],
            "weaknesses": [
                "Could use more quantifiable achievements",
                "Some sections could be more detailed",
                "Consider adding more keywords"
            ],
            "sections": mock_sections,
            "overallScore": 88
        }

        log_info("Analysis complete")
        return results

    except Exception as e:
        log_error(f"Error during analysis: {str(e)}")
        raise
    finally:
        # Cleanup
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

if __name__ == "__main__":
    try:
        # Read input from Node.js
        input_raw = sys.stdin.read()
        if not input_raw:
            raise ValueError("No input received")

        input_data = json.loads(input_raw)
        file_bytes = base64.b64decode(input_data["file_bytes"])
        filename = input_data["filename"]
        log_info(f"Received file: {filename}")

        # Analyze the resume
        results = analyze_resume(file_bytes, filename)
        # Ensure only one JSON output on stdout
        sys.stderr.flush()
        print(json.dumps(results), flush=True)
    except Exception as e:
        log_error(f"Error during analysis: {str(e)}")
        # Ensure error response is valid JSON
        error_response = {"error": True, "message": str(e)}
        print(json.dumps(error_response), flush=True)
        sys.exit(1)