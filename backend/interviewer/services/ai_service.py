"""
OpenRouter AI service for interview question generation, evaluation,
and follow-up question creation with conversation memory.
"""
# pyright: reportMissingImports=false

from __future__ import annotations

import json
import traceback
from openai import AsyncOpenAI

from ..config import get_settings
from ..exceptions import AIServiceError

# ── Prompt templates ─────────────────────────────────────────

_SYSTEM_PROMPT = (
    "You are an expert AI interviewer. You must always respond with valid JSON only. "
    "Never include markdown formatting, code fences, or extra text around the JSON."
)

_QUESTION_GEN_TEMPLATE = """Generate {count} interview questions for a {interview_type} interview.

**Position:** {target_role}
**Difficulty:** {difficulty}
**Candidate skills:** {skills}
**Focus areas:** {focus_areas}
**Company type:** {company_type}
{resume_section}

Rules:
- Tailor questions to the candidate's background and target role.
- For "technical": include coding, system design, and domain questions.
- For "hr": include culture-fit, motivation, and situational questions.
- For "behavioral": use the STAR method and probe past experience.
- For "mixed": blend all three types proportionally.
- Vary difficulty across the set.

Return ONLY a JSON array:
[
  {{
    "question_number": 1,
    "question_text": "...",
    "question_type": "{interview_type}",
    "difficulty": "{difficulty}",
    "expected_answer": "Brief ideal answer outline",
    "keywords": ["key", "concepts"]
  }}
]"""

_FOLLOWUP_TEMPLATE = """You are conducting a {interview_type} interview for {target_role}.

Conversation so far:
{history}

The candidate just answered:
Q: {last_question}
A: {last_answer}

Previous evaluation score: {score}/10

Generate ONE follow-up question that:
1. Probes deeper based on their answer quality.
2. If score < 5, ask a simpler clarifying question.
3. If score >= 7, increase difficulty or explore an advanced angle.
4. Maintain natural interview flow.

Return ONLY a JSON object:
{{
  "question_number": {next_num},
  "question_text": "...",
  "question_type": "{interview_type}",
  "difficulty": "{adjusted_difficulty}",
  "expected_answer": "...",
  "keywords": ["..."]
}}"""

_EVALUATE_TEMPLATE = """Evaluate this interview answer.

**Question:** {question}
**Expected concepts:** {keywords}
**Candidate answer:** {answer}
**Interview type:** {interview_type}
**Difficulty:** {difficulty}

Evaluate on:
1. Correctness and completeness (40%)
2. Clarity of communication (20%)
3. Use of examples/specifics (20%)
4. Depth of understanding (20%)

Return ONLY a JSON object:
{{
  "score": <float 1.0-10.0>,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "improvements": ["..."],
  "sample_answer": "A concise ideal answer (2-3 sentences)"
}}"""

_FINAL_SUMMARY_TEMPLATE = """Generate a comprehensive interview summary.

**Position:** {target_role}
**Interview type:** {interview_type}

Questions and evaluations:
{qa_summary}

Return ONLY a JSON object:
{{
  "average_score": <float>,
  "strengths": ["top 3 strengths"],
  "weaknesses": ["top 3 weaknesses"],
  "recommendations": ["top 3 improvement tips"],
  "skill_scores": {{"skill_name": <float_score>}},
  "communication_score": <float>,
  "technical_score": <float>,
  "problem_solving_score": <float>,
  "ai_summary": "2-3 sentence overall assessment",
  "overall_feedback": "Detailed paragraph of feedback"
}}"""


class AIService:
    """Async wrapper around OpenRouter for all AI operations."""

    def __init__(self) -> None:
        settings = get_settings()
        self.client = AsyncOpenAI(
            base_url=settings.OPENROUTER_BASE_URL,
            api_key=settings.OPENROUTER_API_KEY,
        )
        self.model = settings.AI_MODEL
        self.temperature = settings.AI_TEMPERATURE
        self.max_tokens = settings.AI_MAX_TOKENS

    # ── helpers ────────────────────────────────────────────────

    async def _call(self, prompt: str, max_tokens: int | None = None) -> str:
        """Send a single-turn prompt and return raw content."""
        try:
            resp = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=self.temperature,
                max_tokens=max_tokens or self.max_tokens,
            )
            return resp.choices[0].message.content.strip()
        except Exception as exc:
            print(f"[AIService] OpenRouter error: {exc}")
            traceback.print_exc()
            raise AIServiceError(str(exc))

    @staticmethod
    def _parse_json(text: str):
        """Strip markdown fences and parse JSON."""
        cleaned = text
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        return json.loads(cleaned)

    # ── public API ─────────────────────────────────────────────

    async def generate_questions(
        self,
        *,
        target_role: str,
        interview_type: str,
        difficulty: str,
        skills: list[str],
        focus_areas: list[str],
        company_type: str,
        count: int = 5,
        resume_text: str | None = None,
    ) -> list[dict]:
        """Generate an initial batch of interview questions."""
        resume_section = ""
        if resume_text:
            # Truncate to keep prompt manageable
            snippet = resume_text[:2000]
            resume_section = f"**Resume highlights:**\n{snippet}"

        prompt = _QUESTION_GEN_TEMPLATE.format(
            count=count,
            interview_type=interview_type,
            target_role=target_role,
            difficulty=difficulty,
            skills=", ".join(skills) if skills else "Not specified",
            focus_areas=", ".join(focus_areas) if focus_areas else "General",
            company_type=company_type,
            resume_section=resume_section,
        )

        raw = await self._call(prompt)
        questions = self._parse_json(raw)

        if not isinstance(questions, list) or len(questions) == 0:
            raise AIServiceError("AI returned no questions")
        return questions

    async def generate_followup(
        self,
        *,
        target_role: str,
        interview_type: str,
        difficulty: str,
        conversation_history: list[dict],
        last_question: str,
        last_answer: str,
        last_score: float,
        next_number: int,
    ) -> dict:
        """Generate a dynamic follow-up question based on conversation."""
        history_text = ""
        for entry in conversation_history[-6:]:  # keep last 6 Q&A pairs
            history_text += f"Q{entry['num']}: {entry['q']}\nA: {entry['a']}\nScore: {entry['score']}/10\n\n"

        adjusted = difficulty
        if last_score < 5:
            adjusted = "easy" if difficulty != "easy" else difficulty
        elif last_score >= 8:
            adjusted = "hard" if difficulty != "hard" else difficulty

        prompt = _FOLLOWUP_TEMPLATE.format(
            interview_type=interview_type,
            target_role=target_role,
            history=history_text or "No prior conversation.",
            last_question=last_question,
            last_answer=last_answer,
            score=last_score,
            next_num=next_number,
            adjusted_difficulty=adjusted,
        )

        raw = await self._call(prompt)
        return self._parse_json(raw)

    async def evaluate_answer(
        self,
        *,
        question: str,
        answer: str,
        keywords: list[str] | None,
        interview_type: str,
        difficulty: str,
    ) -> dict:
        """Evaluate a candidate answer and return structured feedback."""
        prompt = _EVALUATE_TEMPLATE.format(
            question=question,
            keywords=", ".join(keywords) if keywords else "N/A",
            answer=answer,
            interview_type=interview_type,
            difficulty=difficulty,
        )

        raw = await self._call(prompt)
        result = self._parse_json(raw)

        # Ensure score is a float in range
        score = float(result.get("score", 5.0))
        result["score"] = max(1.0, min(10.0, score))
        return result

    async def generate_final_summary(
        self,
        *,
        target_role: str,
        interview_type: str,
        qa_pairs: list[dict],
    ) -> dict:
        """Generate overall interview results and recommendations."""
        qa_text = ""
        for pair in qa_pairs:
            qa_text += (
                f"Q{pair['num']}: {pair['q']}\n"
                f"A: {pair['a']}\n"
                f"Score: {pair['score']}/10\n"
                f"Feedback: {pair.get('feedback', 'N/A')}\n\n"
            )

        prompt = _FINAL_SUMMARY_TEMPLATE.format(
            target_role=target_role,
            interview_type=interview_type,
            qa_summary=qa_text,
        )

        raw = await self._call(prompt, max_tokens=2000)
        return self._parse_json(raw)
