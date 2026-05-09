"""
Core interview business logic – session management, answer flow,
scoring, and result generation.
"""

from __future__ import annotations

import uuid
import traceback
from datetime import datetime, timezone

from ..db import get_supabase
from ..exceptions import (
    SessionNotFoundError,
    QuestionNotFoundError,
    SessionAlreadyCompleteError,
    AIServiceError,
)
from .ai_service import AIService
from .rubric_scorer import RubricScorer

ai = AIService()
rubric = RubricScorer()


# ── Helpers ────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _question_count_for_duration(minutes: int) -> int:
    """Estimate the number of questions based on interview duration."""
    if minutes <= 15:
        return 5
    if minutes <= 30:
        return 8
    if minutes <= 45:
        return 10
    return 12


# ── Session lifecycle ──────────────────────────────────────────

async def start_interview(data: dict) -> dict:
    """
    Create a new interview session, generate questions via AI,
    persist the first batch, and return the session info + first question.
    """
    db = get_supabase()
    session_text_id = str(uuid.uuid4())
    question_count = _question_count_for_duration(data.get("interview_duration", 30))

    # 1. Insert session
    session_payload = {
        "user_id": data["user_id"],
        "session_id": session_text_id,
        "full_name": data["full_name"],
        "email": data["email"],
        "target_job_role": data["target_job_role"],
        "years_of_experience": data["years_of_experience"],
        "skills": data.get("skills", []),
        "interview_type": data["interview_type"],
        "difficulty_level": data["difficulty_level"],
        "preferred_language": data.get("preferred_language", "English"),
        "job_description": data.get("job_description"),
        "company_type": data.get("company_type", "product"),
        "interview_duration": data.get("interview_duration", 30),
        "focus_areas": data.get("focus_areas", []),
        "voice_based_interview": data.get("voice_based_interview", False),
        "mock_interview_goal": data.get("mock_interview_goal", "practice"),
        "status": "in_progress",
        "started_at": _now_iso(),
    }

    resp = db.table("interview_sessions").insert(session_payload).execute()
    if not resp.data:
        raise AIServiceError("Failed to create interview session in database")
    session_row = resp.data[0]
    session_uuid = session_row["id"]  # DB-generated UUID PK

    # 2. Generate questions via AI
    try:
        ai_questions = await ai.generate_questions(
            target_role=data["target_job_role"],
            interview_type=data["interview_type"],
            difficulty=data["difficulty_level"],
            skills=data.get("skills", []),
            focus_areas=data.get("focus_areas", []),
            company_type=data.get("company_type", "product"),
            count=question_count,
            resume_text=data.get("resume_text"),
        )
    except Exception as exc:
        print(f"[interview_service] AI question generation failed: {exc}")
        traceback.print_exc()
        # Fallback: generate placeholder questions
        ai_questions = _fallback_questions(data, question_count)

    # 3. Persist questions
    question_rows = []
    for q in ai_questions:
        question_rows.append({
            "session_id": session_uuid,
            "question_number": q.get("question_number", 1),
            "question_text": q["question_text"],
            "question_type": q.get("question_type", data["interview_type"]),
            "difficulty": q.get("difficulty", data["difficulty_level"]),
            "expected_answer": q.get("expected_answer"),
            "keywords": q.get("keywords", []),
            "ai_context": {"generated_at": _now_iso(), "model": ai.model},
        })

    q_resp = db.table("interview_questions").insert(question_rows).execute()
    saved_questions = q_resp.data or []

    first_q = saved_questions[0] if saved_questions else question_rows[0]

    return {
        "success": True,
        "session_id": session_text_id,
        "session_uuid": session_uuid,
        "first_question": {
            "id": first_q.get("id", ""),
            "question_number": first_q["question_number"],
            "question_text": first_q["question_text"],
            "question_type": first_q["question_type"],
            "difficulty": first_q["difficulty"],
            "keywords": first_q.get("keywords"),
        },
        "total_planned_questions": len(saved_questions),
        "message": "Interview session started",
    }


async def submit_answer(data: dict) -> dict:
    """
    Accept an answer, evaluate it with AI, optionally generate a follow-up,
    and return the evaluation + next question.
    """
    db = get_supabase()
    session_id = data["session_id"]      # text session_id
    question_id = data["question_id"]
    answer_text = data["answer_text"]

    # 1. Resolve session
    s_resp = (
        db.table("interview_sessions")
        .select("*")
        .eq("session_id", session_id)
        .maybe_single()
        .execute()
    )
    if not s_resp or not s_resp.data:
        raise SessionNotFoundError(session_id)
    session = s_resp.data
    if session["status"] == "completed":
        raise SessionAlreadyCompleteError(session_id)
    session_uuid = session["id"]

    # 2. Resolve question
    q_resp = (
        db.table("interview_questions")
        .select("*")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )
    if not q_resp or not q_resp.data:
        raise QuestionNotFoundError(question_id)
    question = q_resp.data

    # 3. Evaluate answer with AI
    try:
        evaluation = await ai.evaluate_answer(
            question=question["question_text"],
            answer=answer_text,
            keywords=question.get("keywords"),
            interview_type=session["interview_type"],
            difficulty=question["difficulty"],
        )
    except Exception as exc:
        print(f"[interview_service] AI evaluation failed: {exc}")
        evaluation = {
            "score": 5.0,
            "strengths": ["Answer was provided"],
            "weaknesses": ["Could not evaluate automatically"],
            "improvements": ["Review the question again"],
            "sample_answer": None,
        }

    # 4. Save answer
    rubric_scores = rubric.score_answer(
        answer_text=answer_text,
        question_text=question["question_text"],
        keywords=question.get("keywords") or [],
        session_skills=session.get("skills") or [],
        ai_score_10=evaluation.get("score"),
        transcript_confidence=data.get("transcript_confidence"),
    )

    answer_payload = {
        "question_id": question_id,
        "session_id": session_uuid,
        "user_id": session["user_id"],
        "answer_text": answer_text,
        "answer_audio_url": data.get("answer_audio_url"),
        "time_taken": data.get("time_taken"),
        "ai_score": evaluation["score"],
        "ai_feedback": {
            "strengths": evaluation.get("strengths", []),
            "weaknesses": evaluation.get("weaknesses", []),
            "improvements": evaluation.get("improvements", []),
            "sample_answer": evaluation.get("sample_answer"),
            "rubric": rubric_scores,
        },
        "submitted_at": _now_iso(),
        "evaluated_at": _now_iso(),
    }
    db.table("interview_answers").insert(answer_payload).execute()

    # 5. Determine next question
    all_questions = (
        db.table("interview_questions")
        .select("*")
        .eq("session_id", session_uuid)
        .order("question_number")
        .execute()
    ).data or []

    answered_ids = set()
    answers_resp = (
        db.table("interview_answers")
        .select("question_id")
        .eq("session_id", session_uuid)
        .execute()
    )
    if answers_resp.data:
        answered_ids = {a["question_id"] for a in answers_resp.data}

    unanswered = [q for q in all_questions if q["id"] not in answered_ids]
    is_last = len(unanswered) == 0

    next_question_out = None
    if not is_last:
        next_q = unanswered[0]
        next_question_out = {
            "id": next_q["id"],
            "question_number": next_q["question_number"],
            "question_text": next_q["question_text"],
            "question_type": next_q["question_type"],
            "difficulty": next_q["difficulty"],
            "keywords": next_q.get("keywords"),
        }
    else:
        # Generate dynamic follow-up OR finalise
        conversation = _build_history(all_questions, db, session_uuid)
        total_answered = len(answered_ids)
        max_q = _question_count_for_duration(session.get("interview_duration", 30))

        if total_answered < max_q:
            # Generate a follow-up
            try:
                followup = await ai.generate_followup(
                    target_role=session["target_job_role"],
                    interview_type=session["interview_type"],
                    difficulty=session["difficulty_level"],
                    conversation_history=conversation,
                    last_question=question["question_text"],
                    last_answer=answer_text,
                    last_score=evaluation["score"],
                    next_number=total_answered + 1,
                )
                # Save follow-up question
                fq_payload = {
                    "session_id": session_uuid,
                    "question_number": followup.get("question_number", total_answered + 1),
                    "question_text": followup["question_text"],
                    "question_type": followup.get("question_type", session["interview_type"]),
                    "difficulty": followup.get("difficulty", session["difficulty_level"]),
                    "expected_answer": followup.get("expected_answer"),
                    "keywords": followup.get("keywords", []),
                    "ai_context": {"type": "followup", "generated_at": _now_iso()},
                }
                fq_resp = db.table("interview_questions").insert(fq_payload).execute()
                if fq_resp.data:
                    fq = fq_resp.data[0]
                    next_question_out = {
                        "id": fq["id"],
                        "question_number": fq["question_number"],
                        "question_text": fq["question_text"],
                        "question_type": fq["question_type"],
                        "difficulty": fq["difficulty"],
                        "keywords": fq.get("keywords"),
                    }
                    is_last = False
            except Exception as exc:
                print(f"[interview_service] Follow-up generation failed: {exc}")
                is_last = True

    # 6. If truly last → finalise session
    if is_last:
        await _finalise_session(session, db)

    return {
        "success": True,
        "evaluation": {
            "score": evaluation["score"],
            "feedback": {
                "strengths": evaluation.get("strengths", []),
                "weaknesses": evaluation.get("weaknesses", []),
                "improvements": evaluation.get("improvements", []),
                "sample_answer": evaluation.get("sample_answer"),
            },
            "rubric": rubric_scores,
            "next_question": next_question_out,
            "is_last_question": is_last,
        },
    }


async def get_history(user_id: str) -> dict:
    """Return all interview sessions for a user."""
    db = get_supabase()
    resp = (
        db.table("interview_sessions")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    sessions = resp.data or []

    summaries = []
    for s in sessions:
        # Fetch result if exists
        r_resp = (
            db.table("interview_results")
            .select("average_score, total_questions")
            .eq("session_id", s["id"])
            .maybe_single()
            .execute()
        )
        r = r_resp.data if r_resp else None
        summaries.append({
            "session_id": s["session_id"],
            "session_uuid": s["id"],
            "target_job_role": s["target_job_role"],
            "interview_type": s["interview_type"],
            "difficulty_level": s["difficulty_level"],
            "status": s["status"],
            "total_questions": r["total_questions"] if r else None,
            "average_score": r["average_score"] if r else None,
            "created_at": s.get("created_at"),
        })

    return {"success": True, "sessions": summaries, "total": len(summaries)}


async def get_session_detail(session_uuid: str) -> dict:
    """Return full session detail including Q&A and results."""
    db = get_supabase()

    s_resp = (
        db.table("interview_sessions")
        .select("*")
        .eq("id", session_uuid)
        .maybe_single()
        .execute()
    )
    if not s_resp or not s_resp.data:
        raise SessionNotFoundError(session_uuid)

    questions = (
        db.table("interview_questions")
        .select("*")
        .eq("session_id", session_uuid)
        .order("question_number")
        .execute()
    ).data or []

    answers = (
        db.table("interview_answers")
        .select("*")
        .eq("session_id", session_uuid)
        .execute()
    ).data or []

    result = (
        db.table("interview_results")
        .select("*")
        .eq("session_id", session_uuid)
        .maybe_single()
        .execute()
    )

    return {
        "success": True,
        "data": {
            "session": s_resp.data,
            "questions": questions,
            "answers": answers,
            "result": result.data if result else None,
        },
    }


# ── Internal helpers ───────────────────────────────────────────

def _build_history(questions: list[dict], db, session_uuid: str) -> list[dict]:
    """Build conversation history for the AI from stored Q&A."""
    answers_resp = (
        db.table("interview_answers")
        .select("*")
        .eq("session_id", session_uuid)
        .execute()
    )
    answer_map = {}
    if answers_resp.data:
        for a in answers_resp.data:
            answer_map[a["question_id"]] = a

    history = []
    for q in questions:
        ans = answer_map.get(q["id"])
        if ans:
            history.append({
                "num": q["question_number"],
                "q": q["question_text"],
                "a": ans["answer_text"],
                "score": ans.get("ai_score", 5),
            })
    return history


async def _finalise_session(session: dict, db) -> None:
    """Mark session complete, generate results via AI, persist."""
    session_uuid = session["id"]

    # Update session status
    db.table("interview_sessions").update({
        "status": "completed",
        "completed_at": _now_iso(),
    }).eq("id", session_uuid).execute()

    # Gather all Q&A
    questions = (
        db.table("interview_questions")
        .select("*")
        .eq("session_id", session_uuid)
        .order("question_number")
        .execute()
    ).data or []

    answers_resp = (
        db.table("interview_answers")
        .select("*")
        .eq("session_id", session_uuid)
        .execute()
    )
    answer_map = {}
    if answers_resp.data:
        for a in answers_resp.data:
            answer_map[a["question_id"]] = a

    qa_pairs = []
    scores = []
    total_time = 0
    rubric_rows: list[dict] = []
    for q in questions:
        ans = answer_map.get(q["id"])
        if ans:
            feedback = ans.get("ai_feedback") or {}
            rubric_data = feedback.get("rubric") if isinstance(feedback, dict) else None
            if not rubric_data:
                rubric_data = rubric.score_answer(
                    answer_text=ans["answer_text"],
                    question_text=q["question_text"],
                    keywords=q.get("keywords") or [],
                    session_skills=session.get("skills") or [],
                    ai_score_10=ans.get("ai_score", 5),
                )
            rubric_rows.append(rubric_data)

            qa_pairs.append({
                "num": q["question_number"],
                "q": q["question_text"],
                "a": ans["answer_text"],
                "score": ans.get("ai_score", 5),
                "feedback": str(ans.get("ai_feedback", "")),
            })
            scores.append(ans.get("ai_score", 5))
            total_time += ans.get("time_taken") or 0

    avg_score = round(sum(scores) / len(scores), 1) if scores else 0

    # AI summary
    try:
        summary = await ai.generate_final_summary(
            target_role=session["target_job_role"],
            interview_type=session["interview_type"],
            qa_pairs=qa_pairs,
        )
    except Exception as exc:
        print(f"[interview_service] Summary generation failed: {exc}")
        summary = {
            "strengths": [],
            "weaknesses": [],
            "recommendations": ["Review your answers and try again"],
            "skill_scores": {},
            "communication_score": avg_score,
            "technical_score": avg_score,
            "problem_solving_score": avg_score,
            "ai_summary": "Interview completed.",
            "overall_feedback": "Please review your responses.",
        }

    rubric_aggregate = rubric.aggregate_session(rubric_rows, session.get("skills") or [])

    ai_skill_scores = summary.get("skill_scores", {}) if isinstance(summary.get("skill_scores"), dict) else {}
    final_skill_scores = {}
    for skill, score in rubric_aggregate.get("skill_scores", {}).items():
        ai_score = ai_skill_scores.get(skill)
        if isinstance(ai_score, (int, float)):
            final_skill_scores[skill] = round((0.7 * score) + (0.3 * float(ai_score) * 10), 1)
        else:
            final_skill_scores[skill] = score

    scoring_meta = (
        f"[scoring_model_version={rubric_aggregate['model_version']};"
        f" confidence_proxy={rubric_aggregate['confidence_proxy']}] "
    )

    result_payload = {
        "session_id": session_uuid,
        "user_id": session["user_id"],
        "total_questions": len(questions),
        "questions_answered": len(qa_pairs),
        "average_score": avg_score,
        "total_time_taken": total_time,
        "strengths": summary.get("strengths", []),
        "weaknesses": summary.get("weaknesses", []),
        "recommendations": summary.get("recommendations", []) + [
            f"Scoring model version: {rubric_aggregate['model_version']}"
        ],
        "skill_scores": final_skill_scores,
        "communication_score": rubric_aggregate["sub_scores"]["communication"],
        "technical_score": rubric_aggregate["sub_scores"]["technical_depth"],
        "problem_solving_score": rubric_aggregate["sub_scores"]["problem_solving"],
        "ai_summary": summary.get("ai_summary", ""),
        "overall_feedback": scoring_meta + summary.get("overall_feedback", ""),
    }
    db.table("interview_results").insert(result_payload).execute()

    # Update user_progress
    _update_user_progress(session["user_id"], avg_score, session, db)


def _update_user_progress(user_id: str, score: float, session: dict, db) -> None:
    """Increment user-level statistics after an interview completes."""
    try:
        prog = (
            db.table("user_progress")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if prog and prog.data:
            p = prog.data
            total = (p.get("total_interviews") or 0) + 1
            completed = (p.get("completed_interviews") or 0) + 1
            old_avg = p.get("average_score") or 0
            new_avg = round(((old_avg * (completed - 1)) + score) / completed, 1)
            practiced = list(set((p.get("skills_practiced") or []) + session.get("skills", [])))

            db.table("user_progress").update({
                "total_interviews": total,
                "completed_interviews": completed,
                "average_score": new_avg,
                "skills_practiced": practiced,
                "target_role": session.get("target_job_role"),
                "last_interview_date": _now_iso()[:10],
                "updated_at": _now_iso(),
            }).eq("user_id", user_id).execute()
        else:
            db.table("user_progress").insert({
                "user_id": user_id,
                "total_interviews": 1,
                "completed_interviews": 1,
                "average_score": score,
                "skills_practiced": session.get("skills", []),
                "target_role": session.get("target_job_role"),
                "last_interview_date": _now_iso()[:10],
            }).execute()
    except Exception as exc:
        print(f"[interview_service] user_progress update failed: {exc}")


def _fallback_questions(data: dict, count: int) -> list[dict]:
    """Generate generic fallback questions when AI fails."""
    role = data.get("target_job_role", "Software Engineer")
    itype = data.get("interview_type", "technical")
    templates = {
        "technical": [
            f"Explain the key technologies you'd use to build a scalable {role} application.",
            f"What design patterns are most relevant for a {role} position?",
            "Describe a challenging technical problem you've solved recently.",
            "How would you approach debugging a production issue?",
            "What is your experience with version control and CI/CD pipelines?",
            "Explain the difference between SQL and NoSQL databases.",
            "How do you ensure code quality in your projects?",
            "Describe your experience with cloud services.",
            "What testing strategies do you follow?",
            "How do you handle technical debt?",
            "Explain microservices architecture.",
            "What security best practices do you follow?",
        ],
        "hr": [
            "Tell me about yourself and your career journey.",
            "Why are you interested in this position?",
            "Where do you see yourself in 5 years?",
            "How do you handle work-life balance?",
            "What motivates you in your work?",
            "Describe your ideal work environment.",
            "How do you handle feedback and criticism?",
            "What are your salary expectations?",
            "Why are you leaving your current position?",
            "What questions do you have for us?",
            "How do you stay updated with industry trends?",
            "Describe a time you went above and beyond.",
        ],
        "behavioral": [
            "Tell me about a time you led a team through a difficult project.",
            "Describe a situation where you had to resolve a conflict.",
            "Give an example of when you failed and what you learned.",
            "How have you handled a tight deadline?",
            "Describe a time you had to learn something new quickly.",
            "Tell me about a time you disagreed with your manager.",
            "How do you prioritise competing tasks?",
            "Describe your biggest professional achievement.",
            "How do you handle ambiguity in requirements?",
            "Tell me about a time you mentored someone.",
            "Describe a situation where you had to adapt to change.",
            "How do you handle pressure?",
        ],
    }
    pool = templates.get(itype, templates["technical"])
    selected = pool[:count]
    return [
        {
            "question_number": i + 1,
            "question_text": q,
            "question_type": itype,
            "difficulty": data.get("difficulty_level", "medium"),
            "expected_answer": None,
            "keywords": [],
        }
        for i, q in enumerate(selected)
    ]
