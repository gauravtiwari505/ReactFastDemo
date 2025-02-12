from services.llm_service import instantiate_llm, invoke_llm
from models.resume_analysis import ResumeAnalysisResponse
from config import OPENAI_API_KEY
from app_constants import templates  # Contains prompt templates

def load_resume_text(file_path: str) -> str:
    """
    Load the resume content from the uploaded file.
    """
    with open(file_path, 'r') as file:
        return file.read()

def analyze_resume(document_id: str):
    """
    Analyze the resume by invoking LLM with various prompts and returning results.
    """
    # Load the resume content from the uploaded file
    resume_text = load_resume_text(f"./tmp/{document_id}")

    # Instantiate LLM using OpenAI or another provider
    llm = instantiate_llm(
        provider="OpenAI",
        temperature=0.5,
        model_name="gpt-3.5-turbo"
    )

    # Example: Analyze summary section using LLM
    summary_content = invoke_llm(
        llm,
        resume_text,
        template_key="PROMPT_EVALUATE_RESUME"
    )

    # Build the response using dynamic fields
    response_data = {
        "contact_info": {
            "candidate_name": "John Doe",
            "candidate_email": "johndoe@example.com"
        },
        "summary": {"CV_summary": summary_content, "score_summary": 85},
        "work_experience": [],
        "projects": [],
        "skills": {"candidate_skills": ["Python", "React"], "score_skills": 90}
    }

    return ResumeAnalysisResponse(**response_data)
