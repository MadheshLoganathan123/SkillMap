"""
Realtime websocket transport for AI interview voice sessions.
Keeps the existing HTTP flow intact and reuses interview_service.submit_answer.
"""
# pyright: reportMissingImports=false

from __future__ import annotations

import json
import os
from collections import defaultdict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..db import get_supabase
from ..exceptions import InterviewerError
from ..services import interview_service
from ..services.stt_provider import get_stt_provider
from ..services.tts_provider import get_tts_provider

router = APIRouter(prefix="/api/interview", tags=["interview-websocket"])


class _ConnectionState:
    def __init__(self) -> None:
        self.current_transcript = ""
        self.question_id: str | None = None


_session_states: dict[str, _ConnectionState] = defaultdict(_ConnectionState)
stt_provider = get_stt_provider()
tts_provider = get_tts_provider()


def _session_by_text_id(session_id: str) -> dict | None:
    db = get_supabase()
    resp = (
        db.table("interview_sessions")
        .select("*")
        .eq("session_id", session_id)
        .maybe_single()
        .execute()
    )
    return resp.data if resp else None


def _next_unanswered_question(session_uuid: str) -> dict | None:
    db = get_supabase()
    questions = (
        db.table("interview_questions")
        .select("*")
        .eq("session_id", session_uuid)
        .order("question_number")
        .execute()
    ).data or []
    if not questions:
        return None

    answers_resp = (
        db.table("interview_answers")
        .select("question_id")
        .eq("session_id", session_uuid)
        .execute()
    )
    answered_ids = {row["question_id"] for row in (answers_resp.data or [])}
    for q in questions:
        if q["id"] not in answered_ids:
            return q
    return None


def _question_out(question: dict | None) -> dict | None:
    if not question:
        return None
    return {
        "id": question["id"],
        "question_number": question["question_number"],
        "question_text": question["question_text"],
        "question_type": question["question_type"],
        "difficulty": question["difficulty"],
        "keywords": question.get("keywords"),
    }


async def _send_error(ws: WebSocket, message: str, code: str = "WS_ERROR") -> None:
    await ws.send_json({"type": "error", "code": code, "message": message})


@router.websocket("/ws/{session_id}")
async def interview_ws(websocket: WebSocket, session_id: str):
    """
    Event protocol (all JSON):
    - session_init
    - question_audio_request
    - audio_chunk
    - partial_transcript
    - final_transcript
    - answer_submit
    - evaluation
    - next_question
    - session_complete
    - error
    """
    if os.getenv("VOICE_INTERVIEW_V1", "false").lower() != "true":
      await websocket.accept()
      await websocket.send_json({
          "type": "error",
          "code": "FEATURE_DISABLED",
          "message": "VOICE_INTERVIEW_V1 is disabled",
      })
      await websocket.close(code=1008)
      return

    await websocket.accept()
    state = _session_states[session_id]

    try:
        while True:
            payload = await websocket.receive_json()
            event_type = payload.get("type")
            session = _session_by_text_id(session_id)

            if not session:
                await _send_error(websocket, f"Session not found: {session_id}", "SESSION_NOT_FOUND")
                continue

            if event_type == "session_init":
                if session.get("status") == "completed":
                    await websocket.send_json({"type": "session_complete", "session_id": session_id})
                    continue

                next_question = _next_unanswered_question(session["id"])
                if next_question:
                    state.question_id = next_question["id"]
                await websocket.send_json({
                    "type": "session_init",
                    "session_id": session_id,
                    "session_uuid": session["id"],
                    "status": session.get("status", "in_progress"),
                    "next_question": _question_out(next_question),
                })

            elif event_type == "question_audio_request":
                question = _next_unanswered_question(session["id"])
                if question:
                    state.question_id = question["id"]
                    tts = await tts_provider.synthesize(
                        text=question["question_text"],
                        voice=payload.get("voice"),
                    )
                    await websocket.send_json({
                        "type": "next_question",
                        "question": _question_out(question),
                        "audio": {
                            "provider": tts.provider,
                            "voice": tts.voice,
                            "audio_url": tts.audio_url,
                            "mime_type": tts.mime_type,
                        },
                    })
                else:
                    await websocket.send_json({"type": "session_complete", "session_id": session_id})

            elif event_type == "audio_chunk":
                chunk_text = str(payload.get("chunk", "")).strip()
                is_final = bool(payload.get("is_final", False))
                transcript_result = await stt_provider.transcribe_chunk(
                    session_id=session_id,
                    chunk=chunk_text,
                    is_final=is_final,
                )

                if transcript_result.transcript:
                    state.current_transcript = (
                        f"{state.current_transcript} {transcript_result.transcript}".strip()
                    )
                    await websocket.send_json({
                        "type": "partial_transcript",
                        "transcript": state.current_transcript,
                        "confidence": transcript_result.confidence,
                        "provider": transcript_result.provider,
                        "is_final": transcript_result.is_final,
                    })
                if transcript_result.is_final:
                    await websocket.send_json({
                        "type": "final_transcript",
                        "transcript": state.current_transcript,
                        "confidence": transcript_result.confidence,
                        "provider": transcript_result.provider,
                    })

            elif event_type == "final_transcript":
                transcript = str(payload.get("transcript", "")).strip()
                state.current_transcript = transcript
                await websocket.send_json({
                    "type": "final_transcript",
                    "transcript": transcript,
                    "confidence": payload.get("confidence"),
                    "provider": payload.get("provider", "client"),
                })

            elif event_type == "answer_submit":
                question_id = payload.get("question_id") or state.question_id
                answer_text = str(payload.get("answer_text") or state.current_transcript or "").strip()
                time_taken = payload.get("time_taken")
                answer_audio_url = payload.get("answer_audio_url")

                if not question_id:
                    await _send_error(websocket, "question_id is required", "INVALID_PAYLOAD")
                    continue
                if not answer_text:
                    await _send_error(websocket, "answer_text is required", "INVALID_PAYLOAD")
                    continue

                try:
                    result = await interview_service.submit_answer({
                        "session_id": session_id,
                        "question_id": question_id,
                        "answer_text": answer_text,
                        "time_taken": time_taken,
                        "answer_audio_url": answer_audio_url,
                    })
                except InterviewerError as exc:
                    await _send_error(websocket, exc.message, "SERVICE_ERROR")
                    continue
                except Exception as exc:
                    await _send_error(websocket, str(exc), "SERVICE_ERROR")
                    continue

                evaluation = result.get("evaluation", {})
                await websocket.send_json({"type": "evaluation", "evaluation": evaluation})

                next_question = evaluation.get("next_question")
                if next_question:
                    state.question_id = next_question["id"]
                    state.current_transcript = ""
                    await websocket.send_json({"type": "next_question", "question": next_question})
                elif evaluation.get("is_last_question"):
                    state.current_transcript = ""
                    state.question_id = None
                    await websocket.send_json({"type": "session_complete", "session_id": session_id})

            elif event_type == "heartbeat":
                await websocket.send_json({
                    "type": "heartbeat_ack",
                    "session_id": session_id,
                })

            else:
                await _send_error(
                    websocket,
                    f"Unsupported event type: {event_type}",
                    "UNSUPPORTED_EVENT",
                )

    except WebSocketDisconnect:
        pass
    except json.JSONDecodeError:
        await _send_error(websocket, "Invalid JSON payload", "INVALID_JSON")
    except Exception as exc:
        await _send_error(websocket, str(exc), "UNHANDLED_ERROR")
    finally:
        _session_states.pop(session_id, None)
