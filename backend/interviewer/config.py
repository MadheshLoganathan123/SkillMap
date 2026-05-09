"""
Application configuration loaded from .env.local
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from functools import lru_cache

# Load .env.local from project root
_env_path = Path(__file__).resolve().parent.parent.parent / ".env.local"
load_dotenv(_env_path)


class Settings:
    """Central configuration for the AI Interviewer module."""

    # Supabase
    SUPABASE_URL: str = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # OpenRouter
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    # AI Model defaults
    AI_MODEL: str = os.getenv("AI_MODEL", "anthropic/claude-3.5-haiku")
    AI_TEMPERATURE: float = float(os.getenv("AI_TEMPERATURE", "0.7"))
    AI_MAX_TOKENS: int = int(os.getenv("AI_MAX_TOKENS", "3000"))

    # Speech providers (Phase 2)
    STT_PROVIDER: str = os.getenv("STT_PROVIDER", "mock")
    STT_API_KEY: str = os.getenv("STT_API_KEY", "")
    STT_BASE_URL: str = os.getenv("STT_BASE_URL", "")

    TTS_PROVIDER: str = os.getenv("TTS_PROVIDER", "mock")
    TTS_API_KEY: str = os.getenv("TTS_API_KEY", "")
    TTS_BASE_URL: str = os.getenv("TTS_BASE_URL", "")
    TTS_DEFAULT_VOICE: str = os.getenv("TTS_DEFAULT_VOICE", "default")

    # Optional: direct Postgres connection for SQLAlchemy async engine
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # CORS
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")

    @property
    def supabase_url(self) -> str:
        return self.SUPABASE_URL

    @property
    def supabase_key(self) -> str:
        return self.SUPABASE_SERVICE_ROLE_KEY or self.SUPABASE_ANON_KEY

    def validate(self) -> None:
        """Raise if critical variables are missing."""
        if not self.SUPABASE_URL:
            raise ValueError("NEXT_PUBLIC_SUPABASE_URL is required")
        if not self.supabase_key:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required")
        if not self.OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY is required")


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    settings.validate()
    return settings
