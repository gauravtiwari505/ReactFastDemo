import google.generativeai as genai
from langchain_community.document_loaders import PDFMinerLoader
import os
import sys
import json
import base64
from pathlib import Path
import time
from typing import Dict, Any, List

TMP_DIR = Path("./tmp")
os.makedirs(TMP_DIR, exist_ok=True)

# Initialize Gemini with proper error handling
try:
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
    model = genai.GenerativeModel('gemini-1.5-pro')
except Exception as e:
    print(f"Error initializing Gemini: {str(e)}", file=sys.stderr)
    raise

def handle_api_call(func):
    """Decorator to handle API calls with retries and rate limiting"""
    def wrapper(*args, **kwargs):
        max_retries = 3
        retry_delay = 2  # seconds

        for attempt in range(max_retries):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if "429" in str(e) and attempt < max_retries - 1:
                    print(f"Rate limit hit, waiting {retry_delay} seconds...", file=sys.stderr)
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                    continue
                print(f"Error in {func.__name__}: {str(e)}", file=sys.stderr)
                raise
        return func(*args, **kwargs)
    return wrapper

@handle_api_call
def analyze_resume_section(text: str, section_name: str) -> dict:
    """Analyze a specific section of the resume using Gemini with proper error handling."""
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
        response = model.generate_content(prompt)
        try:
            # First try to parse the entire response
            result = json.loads(response.text)
        except:
            # If that fails, try to extract just the JSON part
            text = response.text
            start = text.find('{')
            end = text.rfind('}') + 1
            if start >= 0 and end > start:
                result = json.loads(text[start:end])
            else:
                raise ValueError("No valid JSON found in response")

        # Validate the response has the required fields
        if not all(key in result for key in ["score", "content", "suggestions"]):
            raise ValueError("Missing required fields in response")

        return result
    except Exception as e:
        print(f"Error analyzing section {section_name}: {str(e)}", file=sys.stderr)
        return {
            "score": 0,
            "suggestions": [f"Unable to analyze this section: {str(e)}"],
            "content": "Analysis failed due to an error"
        }

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
        print(f"Error generating overview: {str(e)}", file=sys.stderr)
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
    print("Starting resume analysis...", file=sys.stderr)

    temp_file_path = save_uploaded_file(file_bytes, filename)
    print(f"Saved file to {temp_file_path}", file=sys.stderr)

    try:
        # Load and split document
        loader = PDFMinerLoader(file_path=temp_file_path)
        documents = loader.load()
        print(f"Loaded {len(documents)} document(s)", file=sys.stderr)

        # Extract text content
        full_text = " ".join([doc.page_content for doc in documents])
        print(f"Extracted {len(full_text)} characters of text", file=sys.stderr)

        # Generate overall analysis with rate limiting
        overview_analysis = generate_overview(full_text)
        print("Generated overview analysis", file=sys.stderr)

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
            print(f"Analyzing section: {section}", file=sys.stderr)
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

        print(f"Analysis complete: {json.dumps(results)}", file=sys.stderr)
        return results

    except Exception as e:
        print(f"Error during analysis: {str(e)}", file=sys.stderr)
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
        print(f"Received file: {filename}", file=sys.stderr)

        # Analyze the resume
        results = analyze_resume(file_bytes, filename)
        print(json.dumps(results))  # Send results back to Node.js
        sys.exit(0)
    except Exception as e:
        print(f"Error during analysis: {str(e)}", file=sys.stderr)
        print(json.dumps({"error": str(e)}))
        sys.exit(1)