import google.generativeai as genai
from pdfminer.high_level import extract_text
import os
import sys
import json
import base64
import time
import traceback
from typing import Dict, Any
from datetime import datetime
from io import BytesIO

def log_error(error_msg: str, include_trace: bool = True):
    """Helper function to log errors with optional stack trace"""
    error_output = f"Error: {error_msg}"
    if include_trace:
        error_output += f"\nStack trace:\n{traceback.format_exc()}"
    print(error_output, file=sys.stderr)

def log_info(msg: str):
    """Helper function for logging informational messages"""
    print(f"Info: {msg}", file=sys.stderr)

# Initialize Gemini with proper error handling
try:
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
    model = genai.GenerativeModel('gemini-2.0-flash-lite-preview-02-05')
    model.generation_config = genai.types.GenerationConfig(
        temperature=0.2,
        candidate_count=1,
        top_p=0.8,
        top_k=40,
    )
    log_info("Successfully initialized Gemini model")
except Exception as e:
    log_error(f"Failed to initialize Gemini: {str(e)}")
    raise

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF with robust error handling"""
    try:
        # Create a BytesIO object from the bytes data
        pdf_file = BytesIO(file_bytes)
        text = extract_text(pdf_file)
        if not text.strip():
            raise ValueError("No text content extracted from PDF")
        return text
    except Exception as e:
        log_error(f"PDF extraction error: {str(e)}")
        raise ValueError(f"Failed to extract text from PDF: {str(e)}")
    finally:
        if 'pdf_file' in locals():
            pdf_file.close()

def extract_json_response(text: str) -> Dict[str, Any]:
    """Helper function to extract JSON from response text"""
    try:
        # Remove any non-JSON content before and after the JSON object
        start = text.find('{')
        end = text.rfind('}') + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except:
                # If that fails, try to clean up common issues
                cleaned_text = text[start:end].replace('\n', ' ').strip()
                return json.loads(cleaned_text)
        raise ValueError("No valid JSON found in response")
    except Exception as e:
        log_error(f"JSON parsing error: {str(e)}\nResponse text: {text}")
        raise ValueError("Failed to parse JSON from response")

def analyze_section(text: str, section_name: str, max_retries: int = 3) -> dict:
    """Analyze a specific section of the resume with retry logic"""
    prompt = f"""You are a resume analysis expert. Your task is to analyze this {section_name} section and provide structured feedback.

Resume Text:
{text}

Respond ONLY with a valid JSON object using this exact format. Do not include any other text or explanation:

{{
    "score": <number 0-100>,
    "content": "<clear 2-3 sentence evaluation>",
    "suggestions": [
        "<specific improvement suggestion 1>",
        "<specific improvement suggestion 2>",
        "<specific improvement suggestion 3>"
    ]
}}"""

    for attempt in range(max_retries):
        try:
            response = model.generate_content(prompt)
            if not response.text:
                raise ValueError("Empty response from model")

            result = extract_json_response(response.text)

            # Validate and clean up the response
            if not isinstance(result.get("score"), (int, float)) or not (0 <= result["score"] <= 100):
                result["score"] = 50

            if not isinstance(result.get("content"), str):
                result["content"] = "Content analysis not available"

            if not isinstance(result.get("suggestions"), list):
                result["suggestions"] = ["No specific suggestions provided"]

            # Ensure we have exactly 3 suggestions
            while len(result["suggestions"]) < 3:
                result["suggestions"].append("Consider reviewing this section for improvements")

            # Convert score to integer
            result["score"] = int(result["score"])

            return result
        except Exception as e:
            if attempt == max_retries - 1:
                log_error(f"Failed to analyze section {section_name} after {max_retries} attempts: {str(e)}")
                return {
                    "score": 50,
                    "content": "Unable to analyze this section",
                    "suggestions": [
                        "Please review this section manually",
                        "Consider having a professional review your resume",
                        "Ensure all information is clearly presented"
                    ]
                }
            time.sleep(1)  # Wait before retry

def analyze_resume(file_bytes: bytes) -> Dict[str, Any]:
    """Process and analyze a resume"""
    try:
        # Extract text from PDF
        text = extract_text_from_pdf(file_bytes)
        log_info(f"Extracted {len(text)} characters from PDF")

        # Define sections to analyze
        sections = ["Professional Summary", "Work Experience", "Skills", "Education"]

        # Analyze sections
        section_results = []
        for section in sections:
            result = analyze_section(text, section)
            section_results.append({"name": section, **result})
            time.sleep(1)  # Delay between sections

        # Calculate overall score
        overall_score = sum(section["score"] for section in section_results) // len(section_results) if section_results else 0

        # Generate overview
        overview_prompt = f"""You are a resume analysis expert. Generate a professional overview of this resume.

Resume Text:
{text}

Respond ONLY with a valid JSON object using this exact format. Do not include any other text:

{{
    "overview": "<clear 2-3 sentence professional evaluation>",
    "strengths": [
        "<key strength 1>",
        "<key strength 2>",
        "<key strength 3>"
    ],
    "weaknesses": [
        "<improvement area 1>",
        "<improvement area 2>",
        "<improvement area 3>"
    ]
}}"""

        overview_response = model.generate_content(overview_prompt)
        overview_analysis = extract_json_response(overview_response.text)

        return {
            **overview_analysis,
            "sections": section_results,
            "overallScore": overall_score
        }

    except Exception as e:
        log_error(f"Error during analysis: {str(e)}")
        return {
            "overview": "Analysis failed",
            "strengths": ["Analysis failed"],
            "weaknesses": ["Analysis failed"],
            "sections": [],
            "overallScore": 0
        }

if __name__ == "__main__":
    try:
        # Read input from Node.js
        input_data = json.loads(sys.stdin.read())
        file_bytes = base64.b64decode(input_data["file_bytes"])

        # Analyze the resume
        results = analyze_resume(file_bytes)

        # Send results back to Node.js
        print(json.dumps(results))
        sys.exit(0)
    except Exception as e:
        log_error(f"Error during analysis: {str(e)}")
        # Ensure we always return valid JSON
        print(json.dumps({
            "error": str(e),
            "overview": "Analysis failed",
            "strengths": ["Analysis failed"],
            "weaknesses": ["Analysis failed"],
            "sections": [],
            "overallScore": 0
        }))
        sys.exit(1)