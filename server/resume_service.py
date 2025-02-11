import sys
import json
import base64
from pathlib import Path
import os
from pdfminer.high_level import extract_text
import google.generativeai as genai

# Initialize tmp directory
TMP_DIR = Path("./tmp")
os.makedirs(TMP_DIR, exist_ok=True)

# Initialize Gemini
if not os.getenv("GEMINI_API_KEY"):
    raise ValueError("GEMINI_API_KEY environment variable is required")

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.0-pro')

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from PDF."""
    try:
        text = extract_text(pdf_path)
        if not text.strip():
            raise ValueError("No text content extracted from PDF")
        return text
    except Exception as e:
        print(f"Error extracting text: {str(e)}", file=sys.stderr)
        raise

async def analyze_with_gemini(text: str) -> dict:
    """Analyze resume text using Gemini AI."""
    prompt = f"""Analyze the following resume text and provide a structured evaluation. Include:
    1. A brief overview of the resume
    2. Key strengths (minimum 3)
    3. Areas for improvement (minimum 2)
    4. Detailed section analysis including Professional Summary, Work Experience, Technical Skills, Education, and Projects
    5. A score for each section (0-100)
    6. Specific recommendations for each section
    7. An overall score (0-100)

    Resume Text:
    {text}

    Format the response as a JSON object with the following structure:
    {{
        "overview": "string",
        "strengths": ["string"],
        "weaknesses": ["string"],
        "sections": [
            {{
                "name": "string",
                "score": number,
                "content": "string",
                "suggestions": ["string"]
            }}
        ],
        "overallScore": number
    }}
    """

    response = await model.generate_content(prompt)
    try:
        # Parse the response text as JSON
        result = json.loads(response.text)
        return result
    except json.JSONDecodeError:
        # If the response isn't valid JSON, try to extract the JSON part
        text = response.text
        start = text.find('{')
        end = text.rfind('}') + 1
        if start >= 0 and end > start:
            result = json.loads(text[start:end])
            return result
        raise ValueError("Could not parse Gemini response as JSON")

async def analyze_resume(file_bytes: bytes, filename: str) -> dict:
    """Process and analyze a resume."""
    try:
        # Save uploaded file
        temp_file_path = os.path.join(TMP_DIR, filename)
        with open(temp_file_path, "wb") as temp_file:
            temp_file.write(file_bytes)

        # Extract text from PDF
        text = extract_text_from_pdf(temp_file_path)

        # Analyze with Gemini
        results = await analyze_with_gemini(text)
        return results

    finally:
        # Cleanup
        try:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        except:
            pass

if __name__ == "__main__":
    try:
        input_data = json.loads(sys.stdin.read())
        file_bytes = base64.b64decode(input_data["file_bytes"])
        filename = input_data["filename"]

        import asyncio
        results = asyncio.run(analyze_resume(file_bytes, filename))
        print(json.dumps(results))
    except Exception as e:
        print(json.dumps({"error": True, "message": str(e)}))
        sys.exit(1)