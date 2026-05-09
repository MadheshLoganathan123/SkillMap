"""
Pydantic request / response schemas for the AI Interviewer API.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Request schemas ────────────────────────────────────────────

class InterviewStartRequest(BaseModel):
    """POST /api/interview/start"""
    user_id: str
    full_name: str
    email: str
    target_job_role: str
    years_of_experience: str
    skills: list[str]
    interview_type: str = Field(
        ..., description="technical | hr | behavioral | mixed"
    )
    difficulty_level: str = Field(
        ..., description="easy | medium | hard"
    )
    preferred_language: str = "English"
    job_description: Optional[str] = None
    company_type: str = "product"
    interview_duration: int = Field(30, description="Duration in minutes")
    focus_areas: list[str] = []
    voice_based_interview: bool = False
    mock_interview_goal: str = "practice"
    resume_text: Optional[str] = None


class AnswerSubmitRequest(BaseModel):
    """POST /api/interview/answer"""
    session_id: str
    question_id: str
    answer_text: str
    time_taken: Optional[int] = None  # seconds


class ResumeUploadMeta(BaseModel):
    """Metadata returned after resume upload"""
    user_id: str


# ── Response schemas ───────────────────────────────────────────

class QuestionOut(BaseModel):
    id: str
    question_number: int
    question_text: str
    question_type: str
    difficulty: str
    keywords: Optional[list[str]] = None


class AIFeedback(BaseModel):
    strengths: list[str] = []
    weaknesses: list[str] = []
    improvements: list[str] = []
    sample_answer: Optional[str] = None


class AnswerEvaluation(BaseModel):
    score: float
    feedback: AIFeedback
    next_question: Optional[QuestionOut] = None
    is_last_question: bool = False


class SessionSummary(BaseModel):
    session_id: str
    session_uuid: str
    target_job_role: str
    interview_type: str
    difficulty_level: str
    status: str
    total_questions: Optional[int] = None
    average_score: Optional[float] = None
    created_at: Optional[str] = None


class SessionDetail(BaseModel):
    session: dict
    questions: list[dict]
    answers: list[dict]
    result: Optional[dict] = None


class InterviewStartResponse(BaseModel):
    success: bool
    session_id: str
    session_uuid: str
    first_question: QuestionOut
    total_planned_questions: int
    message: str = "Interview session started"


class AnswerResponse(BaseModel):
    success: bool
    evaluation: AnswerEvaluation


class HistoryResponse(BaseModel):
    success: bool
    sessions: list[SessionSummary]
    total: int


class SessionDetailResponse(BaseModel):
    success: bool
    data: SessionDetail


class ResumeUploadResponse(BaseModel):
    success: bool
    extracted_text: Optional[str] = None
    skills: list[str] = []
    message: str = ""


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: Optional[str] = None
