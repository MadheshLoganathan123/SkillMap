"""
SQLAlchemy ORM models matching the Supabase interview schema.
These models document the schema and can be used for direct DB access
when DATABASE_URL is configured.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Boolean, Text, Float,
    DateTime, ForeignKey, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship

from .db import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True)
    full_name = Column(Text)
    email = Column(Text, unique=True, nullable=False)
    avatar_url = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    session_id = Column(String, unique=True, nullable=False)

    # Interview Setup
    full_name = Column(Text, nullable=False)
    email = Column(Text, nullable=False)
    target_job_role = Column(Text, nullable=False)
    years_of_experience = Column(Text, nullable=False)
    skills = Column(ARRAY(Text), nullable=False)
    interview_type = Column(Text, nullable=False)
    difficulty_level = Column(Text, nullable=False)
    preferred_language = Column(Text, nullable=False)
    job_description = Column(Text)
    company_type = Column(Text, nullable=False)
    interview_duration = Column(Integer, nullable=False)
    focus_areas = Column(ARRAY(Text), nullable=False)
    voice_based_interview = Column(Boolean, default=False)
    mock_interview_goal = Column(Text, nullable=False)

    # Status
    status = Column(
        Text, default="pending",
        info={"check": CheckConstraint(
            "status IN ('pending','in_progress','completed','cancelled')"
        )},
    )
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    questions = relationship("InterviewQuestion", back_populates="session", cascade="all, delete-orphan")
    answers = relationship("InterviewAnswer", back_populates="session", cascade="all, delete-orphan")
    result = relationship("InterviewResult", back_populates="session", uselist=False, cascade="all, delete-orphan")


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False)

    question_number = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(Text, nullable=False)
    difficulty = Column(Text, nullable=False)
    expected_answer = Column(Text)
    keywords = Column(ARRAY(Text))
    ai_context = Column(JSONB)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    session = relationship("InterviewSession", back_populates="questions")
    answer = relationship("InterviewAnswer", back_populates="question", uselist=False, cascade="all, delete-orphan")


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("interview_questions.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    answer_text = Column(Text, nullable=False)
    answer_audio_url = Column(Text)
    time_taken = Column(Integer)

    ai_score = Column(Float)
    ai_feedback = Column(JSONB)

    submitted_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    evaluated_at = Column(DateTime(timezone=True))

    question = relationship("InterviewQuestion", back_populates="answer")
    session = relationship("InterviewSession", back_populates="answers")


class InterviewResult(Base):
    __tablename__ = "interview_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), unique=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    total_questions = Column(Integer, nullable=False)
    questions_answered = Column(Integer, nullable=False)
    average_score = Column(Float)
    total_time_taken = Column(Integer)

    strengths = Column(ARRAY(Text))
    weaknesses = Column(ARRAY(Text))
    recommendations = Column(ARRAY(Text))
    skill_scores = Column(JSONB)

    communication_score = Column(Float)
    technical_score = Column(Float)
    problem_solving_score = Column(Float)

    ai_summary = Column(Text)
    overall_feedback = Column(Text)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    session = relationship("InterviewSession", back_populates="result")


class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), unique=True, nullable=False)

    total_interviews = Column(Integer, default=0)
    completed_interviews = Column(Integer, default=0)
    average_score = Column(Float)
    skills_practiced = Column(ARRAY(Text))

    current_level = Column(Text)
    target_role = Column(Text)
    learning_goals = Column(ARRAY(Text))

    total_time_spent = Column(Integer, default=0)
    streak_days = Column(Integer, default=0)
    last_interview_date = Column(DateTime)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
