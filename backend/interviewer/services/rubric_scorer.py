"""
Deterministic rubric scorer for interview answers.
ML-ready output includes model_version, evidence, and feature-like metrics.
"""

from __future__ import annotations

import re


class RubricScorer:
    MODEL_VERSION = "rubric-v1.0"

    def _clamp(self, value: float, lo: float = 0.0, hi: float = 100.0) -> float:
        return max(lo, min(hi, value))

    def _tokenize(self, text: str) -> list[str]:
        return re.findall(r"[a-z0-9\+\#\.]+", (text or "").lower())

    def _sentence_count(self, text: str) -> int:
        # Lightweight sentence splitter for deterministic scoring.
        chunks = [s.strip() for s in re.split(r"[.!?]+", text or "") if s.strip()]
        return max(1, len(chunks))

    def _keyword_coverage(self, tokens: set[str], keywords: list[str]) -> tuple[float, list[str]]:
        if not keywords:
            return 0.0, []
        keyword_tokens = [k.strip().lower() for k in keywords if k and k.strip()]
        if not keyword_tokens:
            return 0.0, []
        matched = [k for k in keyword_tokens if k in tokens]
        return len(matched) / len(keyword_tokens), matched

    def score_answer(
        self,
        *,
        answer_text: str,
        question_text: str,
        keywords: list[str] | None,
        session_skills: list[str] | None,
        ai_score_10: float | None = None,
        transcript_confidence: float | None = None,
    ) -> dict:
        text = answer_text or ""
        tokens_list = self._tokenize(text)
        tokens = set(tokens_list)
        word_count = len(tokens_list)
        sentence_count = self._sentence_count(text)

        coverage, keyword_matches = self._keyword_coverage(tokens, keywords or [])
        completeness = self._clamp((word_count / 90.0) * 100.0) / 100.0
        confidence_proxy = transcript_confidence if transcript_confidence is not None else ((ai_score_10 or 5.0) / 10.0)
        confidence_proxy = self._clamp(confidence_proxy * 100.0) / 100.0

        avg_sentence_length = word_count / sentence_count if sentence_count else word_count
        sentence_len_score = 1.0 - min(abs(avg_sentence_length - 18.0) / 18.0, 1.0)
        structure_markers = {"first", "then", "because", "therefore", "tradeoff", "approach", "debug", "optimize", "design"}
        marker_hits = len([m for m in structure_markers if m in tokens])
        structure_score = min(marker_hits / 4.0, 1.0)

        clarity = 100.0 * ((0.65 * sentence_len_score) + (0.35 * completeness))
        communication = 100.0 * ((0.45 * clarity / 100.0) + (0.25 * completeness) + (0.30 * confidence_proxy))
        technical_depth = 100.0 * ((0.60 * coverage) + (0.25 * completeness) + (0.15 * min(word_count / 140.0, 1.0)))
        problem_solving = 100.0 * ((0.50 * structure_score) + (0.30 * completeness) + (0.20 * coverage))

        communication = round(self._clamp(communication), 1)
        technical_depth = round(self._clamp(technical_depth), 1)
        clarity = round(self._clamp(clarity), 1)
        problem_solving = round(self._clamp(problem_solving), 1)
        overall = round(self._clamp(
            (0.30 * communication) +
            (0.30 * technical_depth) +
            (0.20 * clarity) +
            (0.20 * problem_solving)
        ), 1)

        skills = [s for s in (session_skills or []) if isinstance(s, str) and s.strip()]
        per_skill_scores: dict[str, float] = {}
        lowered_text = text.lower()
        for skill in skills:
            mentioned = 1.0 if skill.lower() in lowered_text else 0.0
            # Skill score ties answer quality to explicit skill relevance.
            skill_score = self._clamp((0.70 * overall) + (0.20 * technical_depth) + (10.0 * mentioned))
            per_skill_scores[skill] = round(skill_score, 1)

        return {
            "model_version": self.MODEL_VERSION,
            "overall_score": overall,
            "sub_scores": {
                "communication": communication,
                "technical_depth": technical_depth,
                "clarity": clarity,
                "problem_solving": problem_solving,
            },
            "skill_scores": per_skill_scores,
            "evidence": {
                "question_text": question_text,
                "keyword_matches": keyword_matches,
                "keyword_coverage": round(coverage, 3),
                "answer_word_count": word_count,
                "answer_completeness": round(completeness, 3),
                "confidence_proxy": round(confidence_proxy, 3),
                "structure_marker_hits": marker_hits,
            },
        }

    def aggregate_session(self, scored_answers: list[dict], session_skills: list[str] | None) -> dict:
        if not scored_answers:
            empty_skills = {s: 0.0 for s in (session_skills or [])}
            return {
                "model_version": self.MODEL_VERSION,
                "sub_scores": {
                    "communication": 0.0,
                    "technical_depth": 0.0,
                    "clarity": 0.0,
                    "problem_solving": 0.0,
                },
                "skill_scores": empty_skills,
                "confidence_proxy": 0.0,
                "feature_vector": {
                    "answers_count": 0,
                    "avg_keyword_coverage": 0.0,
                    "avg_answer_completeness": 0.0,
                },
            }

        count = len(scored_answers)
        comm = sum(s["sub_scores"]["communication"] for s in scored_answers) / count
        tech = sum(s["sub_scores"]["technical_depth"] for s in scored_answers) / count
        clarity = sum(s["sub_scores"]["clarity"] for s in scored_answers) / count
        problem = sum(s["sub_scores"]["problem_solving"] for s in scored_answers) / count
        conf = sum(s["evidence"]["confidence_proxy"] for s in scored_answers) / count
        avg_cov = sum(s["evidence"]["keyword_coverage"] for s in scored_answers) / count
        avg_comp = sum(s["evidence"]["answer_completeness"] for s in scored_answers) / count

        skill_values: dict[str, list[float]] = {}
        for row in scored_answers:
            for skill, score in row.get("skill_scores", {}).items():
                skill_values.setdefault(skill, []).append(score)

        for skill in (session_skills or []):
            skill_values.setdefault(skill, [])

        skill_scores: dict[str, float] = {}
        for skill, vals in skill_values.items():
            skill_scores[skill] = round(sum(vals) / len(vals), 1) if vals else 0.0

        return {
            "model_version": self.MODEL_VERSION,
            "sub_scores": {
                "communication": round(comm, 1),
                "technical_depth": round(tech, 1),
                "clarity": round(clarity, 1),
                "problem_solving": round(problem, 1),
            },
            "skill_scores": skill_scores,
            "confidence_proxy": round(conf, 3),
            "feature_vector": {
                "answers_count": count,
                "avg_keyword_coverage": round(avg_cov, 3),
                "avg_answer_completeness": round(avg_comp, 3),
            },
        }
