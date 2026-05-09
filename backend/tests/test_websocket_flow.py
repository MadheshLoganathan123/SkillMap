import os
from fastapi.testclient import TestClient
from fastapi import FastAPI


os.environ.setdefault("VOICE_INTERVIEW_V1", "true")

from backend.interviewer.routes import websocket as ws_route  # noqa: E402


def test_websocket_session_init_and_answer_submit(monkeypatch):
    monkeypatch.setattr(
        ws_route,
        "_session_by_text_id",
        lambda session_id: {"id": "session-uuid", "status": "in_progress", "user_id": "user-1"},
    )
    monkeypatch.setattr(
        ws_route,
        "_next_unanswered_question",
        lambda _session_uuid: {
            "id": "q-1",
            "question_number": 1,
            "question_text": "Tell me about TCP handshake",
            "question_type": "technical",
            "difficulty": "medium",
            "keywords": ["tcp", "syn", "ack"],
        },
    )

    async def fake_submit_answer(_payload):
        return {
            "success": True,
            "evaluation": {
                "score": 8.2,
                "feedback": {"strengths": ["Good structure"], "weaknesses": [], "improvements": []},
                "next_question": {
                    "id": "q-2",
                    "question_number": 2,
                    "question_text": "How do retries work?",
                    "question_type": "technical",
                    "difficulty": "medium",
                    "keywords": ["retry"],
                },
                "is_last_question": False,
            },
        }

    monkeypatch.setattr(ws_route.interview_service, "submit_answer", fake_submit_answer)

    test_app = FastAPI()
    test_app.include_router(ws_route.router)
    client = TestClient(test_app)
    with client.websocket_connect("/api/interview/ws/session-text-id") as ws:
        ws.send_json({"type": "session_init"})
        init_msg = ws.receive_json()
        assert init_msg["type"] == "session_init"
        assert init_msg["next_question"]["id"] == "q-1"

        ws.send_json({"type": "answer_submit", "question_id": "q-1", "answer_text": "SYN, SYN-ACK, ACK"})
        eval_msg = ws.receive_json()
        assert eval_msg["type"] == "evaluation"
        assert eval_msg["evaluation"]["score"] == 8.2

        next_msg = ws.receive_json()
        assert next_msg["type"] == "next_question"
        assert next_msg["question"]["id"] == "q-2"
