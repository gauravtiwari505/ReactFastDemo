from pydantic import BaseModel
from typing import List, Dict, Optional

class ContactInformation(BaseModel):
    candidate_name: Optional[str] = "unknown"
    candidate_title: Optional[str] = "unknown"
    candidate_location: Optional[str] = "unknown"
    candidate_email: Optional[str] = "unknown"
    candidate_phone: Optional[str] = "unknown"
    candidate_social_media: Optional[List[str]] = []
    evaluation_ContactInfo: Optional[str] = "unknown"
    score_ContactInfo: int = -1

class SummaryEvaluation(BaseModel):
    CV_summary: Optional[str] = "unknown"
    evaluation_summary: Optional[str] = "unknown"
    score_summary: int = -1
    CV_summary_enhanced: Optional[str] = "unknown"

class WorkExperience(BaseModel):
    job_title: str
    company: Optional[str] = "unknown"
    start_date: Optional[str] = "unknown"
    end_date: Optional[str] = "unknown"
    responsibilities: Optional[List[str]] = []
    score: Optional[int] = -1
    comments: Optional[str] = "No comments provided"
    improvement: Optional[str] = "No improvements made"

class ProjectDetails(BaseModel):
    project_title: str
    start_date: Optional[str] = "unknown"
    end_date: Optional[str] = "unknown"
    project_description: Optional[str] = "No description available"
    score_project: Optional[int] = -1
    comments_project: Optional[str] = "No comments"
    improvement_project: Optional[str] = "No improvements"

class SkillsEvaluation(BaseModel):
    candidate_skills: List[str] = []
    evaluation_skills: Optional[str] = "No evaluation"
    score_skills: int = -1

class ResumeAnalysisResponse(BaseModel):
    contact_info: ContactInformation
    summary: SummaryEvaluation
    work_experience: List[WorkExperience]
    projects: List[ProjectDetails]
    skills: SkillsEvaluation
