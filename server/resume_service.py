import google.generativeai as genai
from pdfminer.high_level import extract_text
import os
import json
import base64
from pathlib import Path
import sys
import traceback
from typing import Dict, Any

def log_error(error_msg: str, include_trace: bool = True):
    """Helper function to log errors with optional stack trace"""
    error_output = f"Error: {error_msg}"
    if include_trace:
        error_output += f"\nStack trace:\n{traceback.format_exc()}"
    print(error_output, file=sys.stderr)

def log_info(msg: str):
    """Helper function for logging informational messages"""
    print(msg, file=sys.stderr)

def log_progress(msg: str):
    """Helper function for logging progress messages"""
    print(f"PROGRESS: {msg}", file=sys.stderr)

# Initialize Gemini
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
model = genai.GenerativeModel('gemini-1.5-flash')

TMP_DIR = Path("./tmp")
os.makedirs(TMP_DIR, exist_ok=True)

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from PDF"""
    try:
        text = extract_text(pdf_path)
        log_info(f"Extracted text from PDF: {len(text)} characters") #Added logging for extracted text length.
        return text
    except Exception as e:
        log_error(f"PDF extraction error: {str(e)}")
        raise ValueError(f"Failed to extract text from PDF: {str(e)}")

def analyze_resume_section(text: str, section_name: str) -> dict:
    """Analyze a specific section of the resume using Gemini."""
    log_progress(f"Analyzing {section_name}...")

    prompt = f"""Analyze the following resume section: {section_name}

    Text to analyze:
    {text}

    Important: Respond with ONLY a JSON object that has exactly these keys:
    {{
        "score": <number 0-100>,
        "content": <string evaluation>,
        "suggestions": [<array of string suggestions>]
    }}"""

    try:
        response = model.generate_content(prompt)
        result = extract_json_response(response.text)
        validate_section_result(result)
        log_info(f"Analysis of {section_name} complete. Score: {result['score']}, Content: {result['content'][:100]}...") #Added logging for section analysis results
        return result
    except Exception as e:
        log_error(f"Error analyzing section {section_name}: {str(e)}")
        return {
            "score": 0,
            "content": f"Analysis failed: {str(e)}",
            "suggestions": ["Error during analysis"]
        }

def analyze_resume(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Process and analyze a resume with improved error handling."""
    log_progress("Starting resume analysis...")

    temp_file_path = os.path.join(TMP_DIR, filename)
    with open(temp_file_path, "wb") as temp_file:
        temp_file.write(file_bytes)

    try:
        # Extract text from PDF
        log_progress("Extracting content from PDF...")
        full_text = extract_text_from_pdf(temp_file_path)


        # Analyze overall profile
        log_progress("Analyzing overall profile...")
        overview_prompt = """Analyze this resume and provide a comprehensive evaluation.
        Focus on specific, actionable insights. Output a JSON with:
        {
            "overview": <2-3 sentence professional overview>,
            "strengths": [<3 specific resume strengths>],
            "weaknesses": [<3 specific areas for improvement>]
        }"""
        overview_response = model.generate_content(f"{overview_prompt}\n\nResume text:\n{full_text}")
        overview_analysis = extract_json_response(overview_response.text)
        log_info(f"Overall profile analysis complete. Overview: {overview_analysis.get('overview', '')[:100]}...") #Added logging for overall analysis


        # Define sections to analyze
        sections = [
            "Professional Summary",
            "Work Experience",
            "Skills",
            "Education",
            "Projects",
            "Languages",
            "Certifications"
        ]

        # Analyze each section
        section_results = []
        for section in sections:
            section_analysis = analyze_resume_section(full_text, section)
            section_results.append({
                "name": section,
                **section_analysis
            })

        # Calculate overall score
        overall_score = sum(section["score"] for section in section_results) / len(section_results) if section_results else 0

        # Prepare final results
        results = {
            "overview": overview_analysis.get("overview", ""),
            "strengths": overview_analysis.get("strengths", []),
            "weaknesses": overview_analysis.get("weaknesses", []),
            "sections": section_results,
            "overallScore": round(overall_score)
        }

        log_progress("Analysis complete!")
        print(json.dumps(results))  # Print results to stdout
        return results

    except Exception as e:
        log_error(f"Error during analysis: {str(e)}")
        raise
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

def extract_json_response(text: str) -> Dict[str, Any]:
    """Extract JSON from response text"""
    try:
        return json.loads(text)
    except:
        # Try to find JSON in the text
        start = text.find('{')
        end = text.rfind('}') + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
        raise ValueError("No valid JSON found in response")

def validate_section_result(result: Dict[str, Any]):
    """Validate section analysis result"""
    required_fields = ["score", "content", "suggestions"]
    if not all(field in result for field in required_fields):
        raise ValueError("Missing required fields in section response")

    try:
        score = int(result["score"])
        if not 0 <= score <= 100:
            raise ValueError(f"Score must be between 0 and 100, got {score}")
        result["score"] = score
    except (ValueError, TypeError):
        raise ValueError(f"Invalid score value: {result.get('score')}")

if __name__ == "__main__":
    try:
        # Read input from Node.js
        input_data = json.loads(sys.stdin.read())
        file_bytes = base64.b64decode(input_data["file_bytes"])
        filename = input_data["filename"]

        # Analyze the resume
        analyze_resume(file_bytes, filename)
        sys.exit(0)
    except Exception as e:
        log_error(f"Error during analysis: {str(e)}")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)