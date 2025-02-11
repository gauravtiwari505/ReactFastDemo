import google.generativeai as genai
from langchain_community.document_loaders import PDFMinerLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
import os
import sys
import json
import base64
from pathlib import Path

TMP_DIR = Path("./tmp")
os.makedirs(TMP_DIR, exist_ok=True)

# Initialize Gemini
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-pro')

def save_uploaded_file(file_bytes, filename):
    """Save the uploaded file to TMP_DIR."""
    temp_file_path = os.path.join(TMP_DIR, filename)
    with open(temp_file_path, "wb") as temp_file:
        temp_file.write(file_bytes)
    return temp_file_path

def analyze_resume_section(text: str, section_name: str) -> dict:
    """Analyze a specific section of the resume using Gemini."""
    prompt = f"""Analyze the following resume {section_name} section and provide:
    1. A score out of 100
    2. A list of specific suggestions for improvement
    3. An evaluation of the content quality

    Text to analyze:
    {text}

    Respond in JSON format:
    {{
        "score": <number>,
        "suggestions": [<string>],
        "content": <string>
    }}
    """

    try:
        response = model.generate_content(prompt)
        # Parse the response text as JSON
        return json.loads(response.text)
    except Exception as e:
        print(f"Error analyzing section {section_name}: {str(e)}", file=sys.stderr)
        return {
            "score": 0,
            "suggestions": ["Unable to analyze this section"],
            "content": "Analysis failed"
        }

def generate_overview(text: str) -> dict:
    """Generate an overview analysis of the entire resume using Gemini."""
    prompt = f"""Analyze this resume and provide:
    1. A brief professional overview
    2. Top 3 strengths
    3. Top 3 areas for improvement

    Resume text:
    {text}

    Respond in JSON format:
    {{
        "overview": <string>,
        "strengths": [<string>, <string>, <string>],
        "weaknesses": [<string>, <string>, <string>]
    }}
    """

    try:
        response = model.generate_content(prompt)
        return json.loads(response.text)
    except Exception as e:
        print(f"Error generating overview: {str(e)}", file=sys.stderr)
        return {
            "overview": "Unable to generate overview",
            "strengths": ["Not available"],
            "weaknesses": ["Not available"]
        }

def analyze_resume(file_bytes, filename):
    """Process and analyze a resume using PDFMiner and Gemini."""
    print("Starting resume analysis...", file=sys.stderr)

    # Save file temporarily
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

        # Generate overall analysis
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

        # Analyze each section
        section_results = []
        for section in sections:
            print(f"Analyzing section: {section}", file=sys.stderr)
            section_analysis = analyze_resume_section(full_text, section)
            section_results.append({
                "name": section,
                **section_analysis
            })

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