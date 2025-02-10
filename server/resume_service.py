from langchain_community.document_loaders import PDFMinerLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
import os
import sys
import json
import base64
from pathlib import Path

TMP_DIR = Path("./tmp")
os.makedirs(TMP_DIR, exist_ok=True)

def save_uploaded_file(file_bytes, filename):
    """Save the uploaded file to TMP_DIR."""
    temp_file_path = os.path.join(TMP_DIR, filename)
    with open(temp_file_path, "wb") as temp_file:
        temp_file.write(file_bytes)
    return temp_file_path

def analyze_resume(file_bytes, filename):
    """Process and analyze a resume using Langchain's document loader."""
    print("Starting resume analysis...", file=sys.stderr)

    # Save file temporarily
    temp_file_path = save_uploaded_file(file_bytes, filename)
    print(f"Saved file to {temp_file_path}", file=sys.stderr)

    try:
        # Load and split document
        loader = PDFMinerLoader(file_path=temp_file_path)
        documents = loader.load()
        print(f"Loaded {len(documents)} document(s)", file=sys.stderr)

        # Split into smaller chunks for better analysis
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
        )
        chunks = text_splitter.split_documents(documents)
        print(f"Split into {len(chunks)} chunks", file=sys.stderr)

        # Extract text content
        full_text = " ".join([doc.page_content for doc in documents])
        print(f"Extracted {len(full_text)} characters of text", file=sys.stderr)

        # Basic section identification (can be enhanced)
        sections = []

        # Professional Summary
        if any(keyword in full_text.lower() for keyword in ["summary", "objective", "profile"]):
            sections.append({
                "name": "Professional Summary",
                "score": 85,
                "suggestions": ["Add more quantifiable achievements"]
            })

        # Work Experience
        if any(keyword in full_text.lower() for keyword in ["experience", "work", "employment"]):
            sections.append({
                "name": "Work Experience",
                "score": 90,
                "suggestions": ["Use more action verbs", "Include metrics and achievements"]
            })

        # Education
        if any(keyword in full_text.lower() for keyword in ["education", "degree", "university"]):
            sections.append({
                "name": "Education",
                "score": 95,
                "suggestions": ["Consider adding relevant coursework"]
            })

        # Skills
        if any(keyword in full_text.lower() for keyword in ["skills", "technologies", "tools"]):
            sections.append({
                "name": "Skills",
                "score": 88,
                "suggestions": ["Group skills by category", "Highlight proficiency levels"]
            })

        # Calculate overall score based on section scores
        overall_score = sum(section["score"] for section in sections) / len(sections) if sections else 0

        results = {
            "sections": sections,
            "overallScore": overall_score
        }
        print(f"Analysis results: {json.dumps(results)}", file=sys.stderr)
        return results

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
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)