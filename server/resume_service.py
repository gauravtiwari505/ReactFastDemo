import google.generativeai as genai
from pdfminer.high_level import extract_text
import os
import json
import base64
from pathlib import Path
import time
import traceback
from typing import Dict, Any
import asyncio

# Define logging functions
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
    """Helper function for logging progress messages that will be shown to user"""
    print(f"PROGRESS:{msg}", flush=True)

# Initialize Gemini
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
model = genai.GenerativeModel('gemini-1.5-flash')

TMP_DIR = Path("./tmp")
os.makedirs(TMP_DIR, exist_ok=True)

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from PDF"""
    try:
        return extract_text(pdf_path)
    except Exception as e:
        log_error(f"PDF extraction error: {str(e)}")
        raise ValueError(f"Failed to extract text from PDF: {str(e)}")

async def generate_overview(text: str) -> dict:
    """Generate an overview analysis of the entire resume using Gemini."""
    formatted_prompt = f"""Analyze this resume and provide a comprehensive evaluation.
    Focus on specific, actionable insights for improving the resume.
    Consider format, content quality, and professional impact.

    Important: Respond with ONLY a JSON object that has exactly these keys:
    {{
        "overview": <string with 2-3 sentence professional overview>,
        "strengths": [<array of 3 specific resume strengths>],
        "weaknesses": [<array of 3 specific areas for improvement>]
    }}

    Resume text:
    {text}"""

    try:
        # Run in executor to prevent blocking
        response = await asyncio.get_event_loop().run_in_executor(
            None, model.generate_content, formatted_prompt
        )
        result = extract_json_response(response.text)
        validate_overview_result(result)
        return result
    except Exception as e:
        log_error(f"Error generating overview: {str(e)}")
        return {
            "overview": f"Analysis failed: {str(e)}",
            "strengths": ["Not available due to error"],
            "weaknesses": ["Not available due to error"]
        }

async def analyze_resume_section(text: str, section_name: str) -> dict:
    """Analyze a specific section of the resume using Gemini."""
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
        # Run in executor to prevent blocking
        response = await asyncio.get_event_loop().run_in_executor(
            None, model.generate_content, prompt
        )
        result = extract_json_response(response.text)
        validate_section_result(result)
        return result
    except Exception as e:
        log_error(f"Error analyzing section {section_name}: {str(e)}")
        return {
            "score": 0,
            "content": f"Analysis failed: {str(e)}",
            "suggestions": ["Error during analysis"]
        }

async def analyze_resume(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Process and analyze a resume with improved error handling."""
    log_progress("Starting your resume analysis...")

    temp_file_path = os.path.join(TMP_DIR, filename)
    with open(temp_file_path, "wb") as temp_file:
        temp_file.write(file_bytes)

    try:
        log_progress("Reading your resume content...")
        full_text = extract_text_from_pdf(temp_file_path)
        log_info(f"Successfully extracted {len(full_text)} characters of text")

        log_progress("Analyzing your overall resume profile...")
        overview_analysis = await generate_overview(full_text)

        sections = [
            "Professional Summary",
            "Work Experience",
            "Skills",
            "Education",
            "Projects"
        ]

        section_results = []
        for section in sections:
            log_progress(f"Evaluating your {section.lower()}...")
            section_analysis = await analyze_resume_section(full_text, section)
            section_results.append({
                "name": section,
                **section_analysis
            })

        overall_score = sum(section["score"] for section in section_results) / len(section_results) if section_results else 0

        results = {
            "overview": overview_analysis.get("overview", ""),
            "strengths": overview_analysis.get("strengths", []),
            "weaknesses": overview_analysis.get("weaknesses", []),
            "sections": section_results,
            "overallScore": round(overall_score)
        }

        log_progress("Analysis complete! Preparing your detailed report...")
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

def validate_overview_result(result: Dict[str, Any]):
    """Validate overview analysis result"""
    required_fields = ["overview", "strengths", "weaknesses"]
    if not all(field in result for field in required_fields):
        raise ValueError("Missing required fields in overview response")

class RateLimiter:
    """Implements a token bucket rate limiter with request tracking"""
    def __init__(self, requests_per_minute=60):
        self.requests_per_minute = requests_per_minute
        self.bucket = requests_per_minute
        self.last_refill = datetime.now()
        self.refill_rate = requests_per_minute / 60.0  # tokens per second
        self.last_request = datetime.now()
        self.min_delay = 1.0  # Minimum delay between requests in seconds

    def _refill_bucket(self):
        now = datetime.now()
        time_passed = (now - self.last_refill).total_seconds()
        self.bucket = min(
            self.requests_per_minute,
            self.bucket + time_passed * self.refill_rate
        )
        self.last_refill = now

    def wait_if_needed(self):
        """Wait if necessary to comply with rate limits"""
        # Ensure minimum delay between requests
        time_since_last = (datetime.now() - self.last_request).total_seconds()
        if time_since_last < self.min_delay:
            sleep_time = self.min_delay - time_since_last
            log_info(f"Rate limiting: Waiting {sleep_time:.2f} seconds...")
            time.sleep(sleep_time)

        # Check token bucket
        self._refill_bucket()
        while self.bucket < 1:
            log_info("Rate limiting: Waiting for token bucket refill...")
            time.sleep(0.1)  # Wait for tokens to refill
            self._refill_bucket()

        self.bucket -= 1
        self.last_request = datetime.now()

# Initialize rate limiter with conservative limits
rate_limiter = RateLimiter(requests_per_minute=30)  # Adjust based on API limits

if __name__ == "__main__":
    try:
        # Ensure stdout is line-buffered
        sys.stdout.reconfigure(line_buffering=True)

        # Read input from Node.js
        input_data = json.loads(sys.stdin.read())
        file_bytes = base64.b64decode(input_data["file_bytes"])
        filename = input_data["filename"]

        # Run the async function using asyncio
        import asyncio
        from datetime import datetime
        results = asyncio.run(analyze_resume(file_bytes, filename))

        # Ensure the results are JSON serializable and properly formatted
        output = json.dumps(results, ensure_ascii=False)
        print(output, flush=True)
        sys.exit(0)
    except Exception as e:
        error_msg = json.dumps({"error": str(e)}, ensure_ascii=False)
        print(error_msg, flush=True)
        sys.exit(1)