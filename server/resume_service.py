import google.generativeai as genai
from langchain_community.document_loaders import PDFMinerLoader
import os
import sys
import json
import base64
from pathlib import Path
import time
import traceback
from typing import Dict, Any, List

TMP_DIR = Path("./tmp")
os.makedirs(TMP_DIR, exist_ok=True)

def log_error(error_msg: str, include_trace: bool = True):
    """Helper function to log errors with optional stack trace"""
    error_output = f"Error: {error_msg}"
    if include_trace:
        error_output += f"\nStack trace:\n{traceback.format_exc()}"
    print(error_output, file=sys.stderr)

def log_info(msg: str):
    """Helper function for logging informational messages"""
    print(msg, file=sys.stderr)

# Initialize Gemini with proper error handling
try:
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
    model = genai.GenerativeModel('gemini-1.5-pro')
    log_info("Successfully initialized Gemini model")
except Exception as e:
    log_error(f"Failed to initialize Gemini: {str(e)}")
    raise

def handle_api_call(func):
    """Decorator to handle API calls with retries and exponential backoff"""
    def wrapper(*args, **kwargs):
        max_retries = 4  # Allow up to 16 seconds (2^4)
        retry_delay = 2  # Initial delay of 2 seconds
        last_error = None

        for attempt in range(max_retries):
            try:
                log_info(f"Attempting {func.__name__} (attempt {attempt + 1}/{max_retries})")
                return func(*args, **kwargs)
            except Exception as e:
                last_error = e
                if "429" in str(e) and attempt < max_retries - 1:
                    wait_time = retry_delay * (2 ** attempt)  # Exponential backoff: 2, 4, 8, 16 seconds
                    log_info(f"Rate limit hit for {func.__name__}, waiting {wait_time} seconds before retry...")
                    time.sleep(wait_time)
                    continue
                else:
                    log_error(f"Error in {func.__name__}: {str(e)}")
                    break

        # If we get here, all retries failed
        if last_error:
            if "429" in str(last_error):
                return {
                    "score": 0,
                    "suggestions": ["Section analysis failed due to rate limiting. Please try again later."],
                    "content": "Rate limit exceeded"
                }
            else:
                return {
                    "score": 0,
                    "suggestions": [f"Section analysis failed: {str(last_error)}"],
                    "content": "Analysis failed"
                }
        return func(*args, **kwargs)
    return wrapper

@handle_api_call
def analyze_resume_section(text: str, section_name: str) -> dict:
    """Analyze a specific section of the resume using Gemini with proper error handling."""
    log_info(f"Starting analysis of section: {section_name}")

    prompts = {
        "Contact Information": """Extract and evaluate the contact information. Output a dictionary with the following keys:
            - score: Rate the contact information by giving a score (integer) from 0 to 100
            - content: Evaluate the contact information in 2-3 sentences
            - suggestions: A list of improvements for the contact section""",
        "Professional Summary": """Extract and evaluate the summary/objective section:
            - If there is no summary section, generate a strong summary in no more than 5 sentences
            - Include: years of experience, top skills and experiences, biggest achievements, and objective
            Output a dictionary with:
            - score: Rate the summary by giving a score (integer) from 0 to 100
            - content: Evaluate the summary format and content in 2-3 sentences
            - suggestions: A list of ways to strengthen the summary""",
        "Work Experience": """Extract and evaluate all work experiences:
            For each work experience analyze:
            - Job title and company
            - Responsibilities and achievements
            - Use of action verbs and metrics
            Output a dictionary with:
            - score: Rate the work experience by giving a score (integer) from 0 to 100
            - content: Evaluate the experience quality in 2-3 sentences
            - suggestions: A list of ways to improve the work experience descriptions""",
        "Skills": """Analyze the skills section and output a dictionary with:
            - score: Rate the skills by giving a score (integer) from 0 to 100
            - content: Evaluate the skills presentation in 2-3 sentences
            - suggestions: A list of ways to improve the skills section""",
        "Education": """Extract and evaluate all educational background:
            For each education entry analyze:
            - Institution name
            - Degree and honors
            - Dates and achievements
            Output a dictionary with:
            - score: Rate the education section by giving a score (integer) from 0 to 100
            - content: Evaluate the education presentation in 2-3 sentences
            - suggestions: A list of ways to improve the education section""",
        "Languages": """Extract and evaluate language proficiencies:
            For each language analyze:
            - Language name
            - Proficiency level
            Output a dictionary with:
            - score: Rate the language section by giving a score (integer) from 0 to 100
            - content: Evaluate the language skills presentation in 2-3 sentences
            - suggestions: A list of ways to improve the language section""",
        "Projects": """Extract and evaluate all projects:
            For each project analyze:
            - Project title and description
            - Technologies used
            - Impact and results
            Output a dictionary with:
            - score: Rate the projects section by giving a score (integer) from 0 to 100
            - content: Evaluate the projects presentation in 2-3 sentences
            - suggestions: A list of ways to improve project descriptions""",
        "Certifications": """Extract and evaluate all certifications:
            For each certification analyze:
            - Certification name
            - Issuing organization
            - Date and validity
            Output a dictionary with:
            - score: Rate the certifications by giving a score (integer) from 0 to 100
            - content: Evaluate the certifications presentation in 2-3 sentences
            - suggestions: A list of ways to improve the certifications section"""
    }

    prompt = f"""Analyze the following resume section: {section_name}

    Text to analyze:
    {text}

    {prompts.get(section_name, prompts["Work Experience"])}

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
        log_info(f"Raw response preview: {response.text[:200]}...")  # Log first 200 chars

        try:
            result = json.loads(response.text)
        except json.JSONDecodeError as e:
            log_info(f"Failed to parse JSON directly, attempting extraction for section: {section_name}")
            # If direct parsing fails, try to extract JSON
            text = response.text
            start = text.find('{')
            end = text.rfind('}') + 1
            if start >= 0 and end > start:
                result = json.loads(text[start:end])
            else:
                raise ValueError(f"No valid JSON found in response for section: {section_name}")

        # Validate the response has the required fields
        required_fields = ["score", "content", "suggestions"]
        missing_fields = [field for field in required_fields if field not in result]
        if missing_fields:
            raise ValueError(f"Missing required fields in response: {missing_fields}")

        log_info(f"Successfully analyzed section: {section_name}")
        return result
    except Exception as e:
        log_error(f"Error analyzing section {section_name}: {str(e)}")
        raise  # Re-raise to let the decorator handle the retry logic

@handle_api_call
def generate_overview(text: str) -> dict:
    """Generate an overview analysis of the entire resume using Gemini."""
    prompt = """Analyze this resume and provide a comprehensive evaluation.
    Focus on specific, actionable insights for improving the resume.
    Consider format, content quality, and professional impact.

    Important: Respond with ONLY a JSON object that has exactly these keys:
    {
        "overview": <string with 2-3 sentence professional overview>,
        "strengths": [<array of 3 specific resume strengths>],
        "weaknesses": [<array of 3 specific areas for improvement>]
    }

    Resume text:
    {text}"""

    try:
        response = model.generate_content(prompt.format(text=text))
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

def validate_overview_result(result: Dict[str, Any]):
    """Validate overview analysis result"""
    required_fields = ["overview", "strengths", "weaknesses"]
    if not all(key in result for key in required_fields):
        raise ValueError("Missing required fields in overview response")

def analyze_resume(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Process and analyze a resume with improved error handling and rate limiting."""
    log_info("Starting resume analysis...")

    temp_file_path = save_uploaded_file(file_bytes, filename)
    log_info(f"Saved file to {temp_file_path}")

    try:
        # Load and split document
        loader = PDFMinerLoader(file_path=temp_file_path)
        documents = loader.load()
        log_info(f"Loaded {len(documents)} document(s)")

        # Extract text content
        full_text = " ".join([doc.page_content for doc in documents])
        log_info(f"Extracted {len(full_text)} characters of text")

        # Generate overall analysis with rate limiting
        overview_analysis = generate_overview(full_text)
        log_info("Generated overview analysis")

        # Define sections to analyze
        sections = [
            "Contact Information",
            "Professional Summary",
            "Work Experience",
            "Skills",
            "Education",
            "Languages",
            "Projects",
            "Certifications"
        ]

        # Analyze each section with proper rate limiting
        section_results = []
        for section in sections:
            log_info(f"Analyzing section: {section}")
            section_analysis = analyze_resume_section(full_text, section)
            section_results.append({
                "name": section,
                **section_analysis
            })
            time.sleep(1)  # Basic rate limiting between sections

        # Calculate overall score
        overall_score = sum(section["score"] for section in section_results) / len(section_results) if section_results else 0

        results = {
            **overview_analysis,
            "sections": section_results,
            "overallScore": round(overall_score)
        }

        log_info(f"Analysis complete: {json.dumps(results)}")
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

if __name__ == "__main__":
    try:
        # Read input from Node.js
        input_data = json.loads(sys.stdin.read())
        file_bytes = base64.b64decode(input_data["file_bytes"])
        filename = input_data["filename"]
        log_info(f"Received file: {filename}")

        # Analyze the resume
        results = analyze_resume(file_bytes, filename)
        print(json.dumps(results))  # Send results back to Node.js
        sys.exit(0)
    except Exception as e:
        log_error(f"Error during analysis: {str(e)}")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)