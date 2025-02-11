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
    model = genai.GenerativeModel('gemini-1.5-flash-preview')
    log_info("Successfully initialized Gemini model")
except Exception as e:
    log_error(f"Failed to initialize Gemini: {str(e)}")
    raise

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF with robust error handling"""
    try:
        text = extract_text(file_bytes)
        if not text.strip():
            raise ValueError("No text content extracted from PDF")
        return text
    except Exception as e:
        log_error(f"PDF extraction error: {str(e)}")
        raise ValueError(f"Failed to extract text from PDF: {str(e)}")

def extract_json_response(text: str) -> Dict[str, Any]:
    """Helper function to extract JSON from response text"""
    try:
        # First try to parse the entire response as JSON
        return json.loads(text)
    except:
        # If that fails, look for JSON-like content
        start = text.find('{')
        end = text.rfind('}') + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except:
                raise ValueError("Failed to parse JSON from response")
        raise ValueError("No valid JSON found in response")

async def analyze_section(text: str, section_name: str) -> dict:
    """Analyze a specific section of the resume"""
    prompt = f"""Analyze this resume section ({section_name}) and provide a JSON response with:
    {{
        "score": (integer 0-100),
        "content": (2-3 sentence evaluation),
        "suggestions": [3 specific improvements]
    }}

    Text to analyze: {text}
    """

    try:
        response = model.generate_content(prompt)
        if not response or not response.text:
            raise ValueError("Empty response from Gemini")

        result = extract_json_response(response.text)

        # Validate and clean up the response
        if not isinstance(result.get("score"), int) or not (0 <= result["score"] <= 100):
            result["score"] = 50  # Default score if invalid

        if not isinstance(result.get("suggestions"), list):
            result["suggestions"] = ["No specific suggestions provided"]

        return result
    except Exception as e:
        log_error(f"Error analyzing section {section_name}: {str(e)}")
        return {
            "score": 0,
            "content": f"Analysis failed: {str(e)}",
            "suggestions": ["Could not analyze this section"]
        }

async def analyze_resume(file_bytes: bytes) -> Dict[str, Any]:
    """Process and analyze a resume"""
    try:
        # Extract text from PDF
        text = extract_text_from_pdf(file_bytes)
        log_info(f"Extracted {len(text)} characters from PDF")

        # Define sections to analyze
        sections = ["Professional Summary", "Work Experience", "Skills", "Education", "Contact Information", "Languages", "Projects", "Certifications"]

        # Analyze sections concurrently
        section_results = []
        for section in sections:
            result = await analyze_section(text, section)
            section_results.append({"name": section, **result})
            # Small delay between requests to avoid rate limiting
            time.sleep(0.5)

        # Calculate overall score
        overall_score = sum(section["score"] for section in section_results) // len(section_results) if section_results else 0

        # Generate overview
        overview_prompt = f"""Analyze this resume and provide a JSON response with:
        {{
            "overview": (2-3 sentence professional evaluation),
            "strengths": [3 key strengths],
            "weaknesses": [3 areas for improvement]
        }}

        Resume text: {text}
        """

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
            "error": str(e),
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
        import asyncio
        results = asyncio.run(analyze_resume(file_bytes))
        print(json.dumps(results))
        sys.exit(0)
    except Exception as e:
        log_error(f"Error during analysis: {str(e)}")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)