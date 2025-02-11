import sys
import json
import base64
from pathlib import Path
import os
from pdfminer.high_level import extract_text

TMP_DIR = Path("./tmp")
os.makedirs(TMP_DIR, exist_ok=True)

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from PDF."""
    try:
        text = extract_text(pdf_path)
        if not text.strip():
            raise ValueError("No text content extracted from PDF")
        return text
    except Exception as e:
        print(f"PDF extraction error: {str(e)}", file=sys.stderr)
        raise ValueError(f"Failed to extract text from PDF: {str(e)}")

def analyze_resume(file_bytes: bytes, filename: str) -> dict:
    """Process and analyze a resume."""
    print("Starting resume analysis...", file=sys.stderr)

    # Save uploaded file
    temp_file_path = os.path.join(TMP_DIR, filename)
    with open(temp_file_path, "wb") as temp_file:
        temp_file.write(file_bytes)

    try:
        # Extract text from PDF
        full_text = extract_text_from_pdf(temp_file_path)
        print(f"Successfully extracted {len(full_text)} characters of text", file=sys.stderr)

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

        print("Analysis complete", file=sys.stderr)
        return results

    except Exception as e:
        print(f"Error during analysis: {str(e)}", file=sys.stderr)
        raise
    finally:
        # Cleanup
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

if __name__ == "__main__":
    try:
        # Read input from Node.js
        input_data = json.loads(sys.stdin.read())
        file_bytes = base64.b64decode(input_data["file_bytes"])
        filename = input_data["filename"]
        print(f"Received file: {filename}", file=sys.stderr)

        # Analyze the resume
        results = analyze_resume(file_bytes, filename)
        print(json.dumps(results))  # Send results back to Node.js
        sys.exit(0)
    except Exception as e:
        print(f"Error during analysis: {str(e)}", file=sys.stderr)
        print(json.dumps({"error": str(e)}))
        sys.exit(1)