import os
import asyncio

os.environ.setdefault("OPENROUTER_API_KEY", "test-key")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon")

from backend.interviewer.services import interview_service  # noqa: E402


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, db, table_name):
        self.db = db
        self.table_name = table_name
        self.filters = {}
        self.payload = None
        self.mode = "select"

    def select(self, _cols="*"):
        self.mode = "select"
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def maybe_single(self):
        self.mode = "maybe_single"
        return self

    def order(self, *_args, **_kwargs):
        return self

    def insert(self, payload):
        self.mode = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.mode = "update"
        self.payload = payload
        return self

    def execute(self):
        if self.table_name == "interview_sessions" and self.mode in {"select", "maybe_single"}:
            return FakeResponse(
                {
                    "id": "session-uuid",
                    "session_id": "session-text-id",
                    "user_id": "user-1",
                    "status": "in_progress",
                    "skills": ["Python", "FastAPI"],
                    "interview_type": "technical",
                    "difficulty_level": "medium",
                    "target_job_role": "Backend Developer",
                    "interview_duration": 30,
                }
            )
        if self.table_name == "interview_questions":
            if self.mode in {"select", "maybe_single"}:
                if self.filters.get("id"):
                    return FakeResponse(
                        {
                            "id": "q-1",
                            "question_number": 1,
                            "question_text": "Explain API rate limiting",
                            "question_type": "technical",
                            "difficulty": "medium",
                            "keywords": ["rate", "limit", "token"],
                        }
                    )
                return FakeResponse(
                    [
                        {
                            "id": "q-1",
                            "question_number": 1,
                            "question_text": "Explain API rate limiting",
                            "question_type": "technical",
                            "difficulty": "medium",
                            "keywords": ["rate", "limit", "token"],
                        }
                    ]
                )
        if self.table_name == "interview_answers":
            if self.mode == "insert":
                self.db.saved_answer = self.payload
                return FakeResponse([self.payload])
            return FakeResponse([])
        return FakeResponse([])


class FakeDB:
    def __init__(self):
        self.saved_answer = None

    def table(self, table_name):
        return FakeQuery(self, table_name)


def test_submit_answer_persists_rubric_and_audio_url(monkeypatch):
    fake_db = FakeDB()
    monkeypatch.setattr(interview_service, "get_supabase", lambda: fake_db)

    async def fake_eval(**_kwargs):
        return {
            "score": 7.8,
            "strengths": ["Clear explanation"],
            "weaknesses": ["Could add examples"],
            "improvements": ["Mention token bucket"],
            "sample_answer": "Use token bucket with per-key quotas.",
        }

    monkeypatch.setattr(interview_service.ai, "evaluate_answer", fake_eval)
    result = asyncio.run(
        interview_service.submit_answer(
            {
                "session_id": "session-text-id",
                "question_id": "q-1",
                "answer_text": "I would enforce limits per API key with a token bucket and bursts.",
                "time_taken": 12,
                "answer_audio_url": "https://cdn.example.com/audio/a1.mp3",
                "transcript_confidence": 0.93,
            }
        )
    )

    assert result["success"] is True
    assert fake_db.saved_answer is not None
    assert fake_db.saved_answer["answer_audio_url"] == "https://cdn.example.com/audio/a1.mp3"
    assert "rubric" in fake_db.saved_answer["ai_feedback"]
    assert fake_db.saved_answer["ai_feedback"]["rubric"]["model_version"].startswith("rubric-")
