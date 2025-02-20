import google.generativeai as genai
from pdfminer.high_level import extract_text
from pdfminer.pdfparser import PDFParser
from pdfminer.pdfdocument import PDFDocument
from pdfminer.pdfpage import PDFPage
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.layout import LAParams
from pdfminer.converter import TextConverter
from io import StringIO
import os
from dotenv import load_dotenv
import sys
import json
import base64
from pathlib import Path
import time
import traceback
from typing import Dict, Any, List
from datetime import datetime, timedelta


# Define logging functions first
def log_error(error_msg: str, include_trace: bool = True):
    """Helper function to log errors with optional stack trace"""
    error_output = f"Error: {error_msg}"
    if include_trace:
        error_output += f"\nStack trace:\n{traceback.format_exc()}"
    print(error_output, file=sys.stderr)


def log_info(msg: str):
    """Helper function for logging informational messages"""
    print(msg, file=sys.stderr)


# Load environment variables
load_dotenv()

# Access environment variables
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY environment variable is not set")

# Initialize Gemini globally
genai.configure(api_key=GOOGLE_API_KEY)
try:
    model = genai.GenerativeModel(
        'gemini-1.5-flash')  # Using flash model for higher rate limits
    log_info("Successfully initialized Gemini model")
except Exception as e:
    log_error(f"Failed to initialize Gemini: {str(e)}")
    raise

TMP_DIR = Path("./tmp")
os.makedirs(TMP_DIR, exist_ok=True)


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from PDF with robust error handling"""
    output_string = StringIO()

    try:
        # Set up PDF parsing tools
        rsrcmgr = PDFResourceManager()
        device = TextConverter(rsrcmgr, output_string, laparams=LAParams())
        interpreter = PDFPageInterpreter(rsrcmgr, device)

        # Open and process PDF file
        with open(pdf_path, 'rb') as file:
            # Create parser and document objects
            parser = PDFParser(file)
            doc = PDFDocument(parser)

            # Process each page
            for page in PDFPage.create_pages(doc):
                interpreter.process_page(page)

        # Get text content
        text = output_string.getvalue()

        if not text.strip():
            raise ValueError("No text content extracted from PDF")

        return text

    except Exception as e:
        log_error(f"PDF extraction error: {str(e)}")
        raise ValueError(f"Failed to extract text from PDF: {str(e)}")
    finally:
        output_string.close()
        device.close()


def analyze_resume(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Process and analyze a resume with improved error handling and rate limiting."""
    stages = [
        "Extracting Text",
        "Analyzing Contact Information",
        "Analyzing Professional Summary",
        "Analyzing Work Experience",
        "Analyzing Skills",
        "Analyzing Education",
        "Analyzing Languages",
        "Analyzing Projects",
        "Analyzing Certifications"
    ]
    
    current_stage_index = 0
    def update_progress(stage: str):
        nonlocal current_stage_index
        current_stage_index += 1
        progress = (current_stage_index / len(stages)) * 100
        store_progress(filename, stage, progress)
        
    log_info("Starting resume analysis...")
    update_progress("Extracting Text")

    temp_file_path = save_uploaded_file(file_bytes, filename)
    log_info(f"Saved file to {temp_file_path}")

    try:
        # Extract text from PDF using our enhanced extraction method
        try:
            full_text = extract_text_from_pdf(temp_file_path)
            log_info(
                f"Successfully extracted {len(full_text)} characters of text")
        except Exception as e:
            log_error(f"Failed to extract text from PDF: {str(e)}")
            raise ValueError(
                "Unable to read PDF content. Please ensure the file is not corrupted or password protected."
            )

        # Generate overview analysis with rate limiting
        overview_analysis = generate_overview(full_text)
        log_info("Generated overview analysis")

        # Define sections to analyze
        sections = [
            "Contact Information", "Professional Summary", "Work Experience",
            "Skills", "Education", "Languages", "Projects", "Certifications"
        ]

        # Analyze each section with proper rate limiting
        section_results = []
        for section in sections:
            log_info(f"Analyzing section: {section}")
            section_analysis = analyze_resume_section(full_text, section)
            section_results.append({"name": section, **section_analysis})

        # Calculate overall score
        overall_score = sum(section["score"]
                            for section in section_results) / len(
                                section_results) if section_results else 0

        # Convert the results to a proper JSON format
        results = {
            "overview": overview_analysis.get("overview", ""),
            "strengths": overview_analysis.get("strengths", []),
            "weaknesses": overview_analysis.get("weaknesses", []),
            "sections": section_results,
            "overallScore": round(overall_score)
        }

        # Ensure the results can be properly serialized to JSON
        json.dumps(
            results
        )  # This will raise an error if the structure isn't JSON-serializable

        log_info("Analysis complete")
        return results

    except Exception as e:
        log_error(f"Error during analysis: {str(e)}")
        raise
    finally:
        # Cleanup
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)


def save_uploaded_file(file_bytes: bytes, filename: str) -> str:
    """Save the uploaded file to TMP_DIR."""
    temp_file_path = os.path.join(TMP_DIR, filename)
    with open(temp_file_path, "wb") as temp_file:
        temp_file.write(file_bytes)
    return temp_file_path


def extract_json_response(text: str) -> Dict[str, Any]:
    """Helper function to extract JSON from response text"""
    try:
        return json.loads(text)
    except:
        start = text.find('{')
        end = text.rfind('}') + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
        raise ValueError("No valid JSON found in response")


def validate_section_result(result: Dict[str, Any]):
    """Validate section analysis result"""
    required_fields = ["score", "content", "suggestions"]
    missing_fields = [
        field for field in required_fields if field not in result
    ]
    if missing_fields:
        raise ValueError(
            f"Missing required fields in response: {missing_fields}")

    # Validate score is an integer between 0 and 100
    try:
        score = int(result["score"])
        if not 0 <= score <= 100:
            raise ValueError(f"Score must be between 0 and 100, got {score}")
        result["score"] = score  # Ensure score is an integer
    except (ValueError, TypeError):
        raise ValueError(f"Invalid score value: {result.get('score')}")


def handle_api_call(func):
    """Decorator to handle API calls with retries and exponential backoff"""

    def wrapper(*args, **kwargs):
        max_retries = 4  # Allow up to 16 seconds (2^4)
        base_delay = 2  # Initial delay of 2 seconds

        for attempt in range(max_retries):
            try:
                # Wait for rate limiter before making request
                rate_limiter.wait_if_needed()

                log_info(
                    f"Attempting {func.__name__} (attempt {attempt + 1}/{max_retries})"
                )
                return func(*args, **kwargs)
            except Exception as e:
                if "429" in str(e) and attempt < max_retries - 1:
                    delay = base_delay * (
                        2**attempt)  # Exponential backoff: 2, 4, 8, 16 seconds
                    log_info(
                        f"Rate limit hit for {func.__name__}, waiting {delay} seconds before retry..."
                    )
                    time.sleep(
                        delay)  # This delay is in addition to the rate limiter
                    continue
                log_error(f"Error in {func.__name__}: {str(e)}")
                return {
                    "score": 0,
                    "suggestions": [f"Analysis failed: {str(e)}"],
                    "content": "Analysis failed"
                }
        return wrapper

    return wrapper


@handle_api_call
def analyze_resume_section(text: str, section_name: str) -> dict:
    """Analyze a specific section of the resume using Gemini with proper error handling."""
    log_info(f"Starting analysis of section: {section_name}")

    # Dictionary of prompts for different resume sections
    prompts = {
        "Contact Information":
        """Extract and evaluate the contact information. Output a dictionary with the following keys:
            - score: Rate the contact information by giving a score (integer) from 0 to 100
            - content: Evaluate the contact information in 2-3 sentences
            - suggestions: A list of improvements for the contact section""",
        "Professional Summary":
        """Extract and evaluate the summary/objective section:
            - If there is no summary section, generate a strong summary in no more than 5 sentences
            - Include: years of experience, top skills and experiences, biggest achievements, and objective
            Output a dictionary with:
            - score: Rate the summary by giving a score (integer) from 0 to 100
            - content: Evaluate the summary format and content in 2-3 sentences
            - suggestions: A list of ways to strengthen the summary""",
        "Work Experience":
        """Analyze the work experience section and provide a detailed evaluation:
            - Quality of role descriptions
            - Use of action verbs and metrics
            - Career progression
            - Impact and achievements

            Output ONLY a JSON object with EXACTLY these fields:
            {
                "score": <integer 0-100>,
                "content": <2-3 sentence evaluation>,
                "suggestions": [<list of 3-5 specific improvements>]
            }""",
        "Skills":
        """Analyze the skills section and output a dictionary with:
            - score: Rate the skills by giving a score (integer) from 0 to 100
            - content: Evaluate the skills presentation in 2-3 sentences
            - suggestions: A list of ways to improve the skills section""",
        "Education":
        """Extract and evaluate all educational background:
            - Institution name
            - Degree and honors
            - Dates and achievements

            Output a dictionary with:
            - score: Rate the education section by giving a score (integer) from 0 to 100
            - content: Evaluate the education presentation in 2-3 sentences
            - suggestions: A list of ways to improve the education section""",
        "Languages":
        """Extract and evaluate language proficiencies:
            - Language name
            - Proficiency level

            Output a dictionary with:
            - score: Rate the language section by giving a score (integer) from 0 to 100
            - content: Evaluate the language skills presentation in 2-3 sentences
            - suggestions: A list of ways to improve the language section""",
        "Projects":
        """Extract and evaluate all projects:
            - Project title and description
            - Technologies used
            - Impact and results

            Output a dictionary with:
            - score: Rate the projects section by giving a score (integer) from 0 to 100
            - content: Evaluate the projects presentation in 2-3 sentences
            - suggestions: A list of ways to improve project descriptions""",
        "Certifications":
        """Extract and evaluate all certifications:
            - Certification name
            - Issuing organization
            - Date and validity

            Output a dictionary with:
            - score: Rate the certifications by giving a score (integer) from 0 to 100
            - content: Evaluate the certifications presentation in 2-3 sentences
            - suggestions: A list of ways to improve the certifications section"""
    }

    # Retrieve the section-specific prompt, or use a default prompt if missing
    prompt = f"""Analyze the following resume section: {section_name}

    Text to analyze:
    {text}

    {prompts.get(section_name, "Analyze this section and provide structured feedback.")}

    Important: Respond with ONLY a JSON object that has exactly these keys:
    {{
        "score": <number 0-100>,
        "content": <string evaluation>,
        "suggestions": [<array of string suggestions>]
    }}"""

    try:
        log_info(f"Sending request to Gemini for section: {section_name}")
        response = model.generate_content(prompt)

        if not response or not response.text:
            raise ValueError("Empty response from Gemini")

        log_info(f"Received response for section: {section_name}")
        log_info(f"Raw response preview: {response.text[:200]}..."
                 )  # Log first 200 chars

        result = extract_json_response(response.text)

        # Validate the response to ensure required fields are present
        validate_section_result(result)

        log_info(f"Successfully analyzed section: {section_name}")
        return result
    except Exception as e:
        log_error(f"Error analyzing section {section_name}: {str(e)}")
        return {
            "score":
            0,
            "content":
            f"Analysis failed: {str(e)}",
            "suggestions": [
                "Resubmit for analysis",
                "Ensure section is properly formatted",
                "Check for special characters that might affect parsing"
            ]
        }


@handle_api_call
def generate_overview(text: str) -> dict:
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
        response = model.generate_content(formatted_prompt)
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


def validate_overview_result(result: Dict[str, Any]):
    """Validate overview analysis result"""
    required_fields = ["overview", "strengths", "weaknesses"]
    if not all(key in result for key in required_fields):
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
        self.bucket = min(self.requests_per_minute,
                          self.bucket + time_passed * self.refill_rate)
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
rate_limiter = RateLimiter(
    requests_per_minute=30)  # Adjust based on API limits

if __name__ == "__main__":
    try:
        # Read input from Node.js
        input_data = json.loads(sys.stdin.read())
        file_bytes = base64.b64decode(input_data["file_bytes"])
        filename = input_data["filename"]
        log_info(f"Received file: {filename}")

        # Analyze the resume
        results = analyze_resume(file_bytes, filename)

        # Ensure the results are JSON serializable before sending
        print(json.dumps(results))  # Send results back to Node.js
        sys.exit(0)
    except Exception as e:
        log_error(f"Error during analysis: {str(e)}")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
