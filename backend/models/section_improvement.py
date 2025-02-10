from pydantic import BaseModel
from typing import Optional, List

class SectionImprovementRequest(BaseModel):
    section_id: str  # The section to improve (e.g., "work_experience", "summary")
    text_to_improve: str  # The section's current text
    suggestions: Optional[List[str]] = []  # Optional suggestions provided by the user

class SectionImprovementResponse(BaseModel):
    improved_text: str  # The improved text from the LLM
    evaluation: Optional[str] = "Evaluation not provided"  # Evaluation or feedback from LLM
    score: int  # New score after improvement
    suggestions_applied: Optional[List[str]] = []  # Any suggestions that were applied
    additional_comments: Optional[str] = "No additional comments provided"
