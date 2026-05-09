"""
FastAPI router for the AI Interviewer endpoints.
All routes are prefixed with /api/interview.
"""

from __future__ import annotations

import traceback

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException

from ..auth import get_current_user, get_optional_user
from ..schemas import (
    InterviewStartRequest,
    AnswerSubmitRequest,
    InterviewStartResponse,
    AnswerResponse,
    HistoryResponse,
    SessionDetailResponse,
    ResumeUploadResponse,
    ErrorResponse,
)
from ..exceptions import InterviewerError
from ..services import interview_service, resume_service

router = APIRouter(prefix="/api/interview", tags=["interview"])


# ── Exception helper ───────────────────────────────────────────

def _err(exc: Exception) -> dict:
    """Convert exception to error-response dict."""
    if isinstance(exc, InterviewerError):
        return {"success": False, "error": exc.message, "detail": None}
    return {"success": False, "error": str(exc), "detail": traceback.format_exc()}


# ── POST /api/interview/start ──────────────────────────────────

@router.post(
    "/start",
    response_model=InterviewStartResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Start a new AI interview session",
)
async def start_interview(
    req: InterviewStartRequest,
    user: dict | None = Depends(get_optional_user),
):
    """
    Create a new interview session, generate AI questions,
    and return the first question.
    """
    try:
        # Use authenticated user_id if available, else use request body
        data = req.model_dump()
        if user:
            data["user_id"] = user["id"]

        result = await interview_service.start_interview(data)
        return result
    except InterviewerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        print(f"[route] /start error: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


# ── POST /api/interview/answer ─────────────────────────────────

@router.post(
    "/answer",
    response_model=AnswerResponse,
    responses={404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Submit an answer and get AI evaluation + next question",
)
async def submit_answer(
    req: AnswerSubmitRequest,
    user: dict | None = Depends(get_optional_user),
):
    """
    Submit an answer to a question. The AI evaluates it, provides
    feedback, and returns the next question or marks the interview
    as complete.
    """
    try:
        data = req.model_dump()
        result = await interview_service.submit_answer(data)
        return result
    except InterviewerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        print(f"[route] /answer error: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


# ── GET /api/interview/history ─────────────────────────────────

@router.get(
    "/history",
    response_model=HistoryResponse,
    responses={401: {"model": ErrorResponse}},
    summary="Get interview history for the authenticated user",
)
async def get_history(
    user_id: str | None = None,
    user: dict | None = Depends(get_optional_user),
):
    """
    Return all interview sessions for the user, sorted by most recent.
    Accepts user_id as query param or uses authenticated user.
    """
    try:
        uid = (user["id"] if user else None) or user_id
        if not uid:
            raise HTTPException(status_code=400, detail="user_id is required")
        result = await interview_service.get_history(uid)
        return result
    except InterviewerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[route] /history error: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


# ── GET /api/interview/session/{id} ────────────────────────────

@router.get(
    "/session/{session_id}",
    response_model=SessionDetailResponse,
    responses={404: {"model": ErrorResponse}},
    summary="Get full details of an interview session",
)
async def get_session(
    session_id: str,
    user: dict | None = Depends(get_optional_user),
):
    """
    Return full session details including all questions, answers,
    evaluations, and final results.
    """
    try:
        result = await interview_service.get_session_detail(session_id)
        return result
    except InterviewerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        print(f"[route] /session/{session_id} error: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


# ── POST /api/interview/upload-resume ──────────────────────────

@router.post(
    "/upload-resume",
    response_model=ResumeUploadResponse,
    responses={422: {"model": ErrorResponse}},
    summary="Upload a resume PDF for interview context",
)
async def upload_resume(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    user: dict | None = Depends(get_optional_user),
):
    """
    Upload a PDF resume. The text is extracted and skills are
    identified for use in generating personalised interview questions.
    """
    try:
        uid = (user["id"] if user else None) or user_id
        file_bytes = await file.read()

        extracted_text = await resume_service.extract_resume_text(
            file_bytes, file.filename or "resume.pdf"
        )
        skills = resume_service.extract_skills_from_text(extracted_text)

        # Optionally persist to the resumes table
        try:
            from ..db import get_supabase
            db = get_supabase()
            db.table("resumes").upsert(
                {
                    "user_id": uid,
                    "raw_text": extracted_text,
                    "structured_data": {"skills": skills},
                    "updated_at": "now()",
                },
                on_conflict="user_id",
            ).execute()
        except Exception as save_err:
            print(f"[route] resume save warning: {save_err}")

        return {
            "success": True,
            "extracted_text": extracted_text[:3000],  # truncate for response
            "skills": skills,
            "message": f"Resume processed. Found {len(skills)} skills.",
        }
    except InterviewerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        print(f"[route] /upload-resume error: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))
