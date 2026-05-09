"""
Database connections: Supabase client + optional async SQLAlchemy engine.
"""

from __future__ import annotations

from supabase import create_client, Client
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
    AsyncEngine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings

# ---------- SQLAlchemy declarative base ----------

class Base(DeclarativeBase):
    pass


# ---------- Supabase client (always available) ----------

_supabase: Client | None = None


def get_supabase() -> Client:
    """Return a Supabase client using the service-role key."""
    global _supabase
    if _supabase is None:
        s = get_settings()
        _supabase = create_client(s.supabase_url, s.supabase_key)
    return _supabase


# ---------- Async SQLAlchemy (optional – set DATABASE_URL) ----------

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _init_engine() -> AsyncEngine | None:
    global _engine, _session_factory
    s = get_settings()
    if not s.DATABASE_URL:
        return None
    url = s.DATABASE_URL
    # Ensure we use the asyncpg driver
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    _engine = create_async_engine(url, echo=False, pool_size=5, max_overflow=10)
    _session_factory = async_sessionmaker(
        _engine, class_=AsyncSession, expire_on_commit=False
    )
    return _engine


async def get_db_session():
    """Yield an async SQLAlchemy session if DATABASE_URL is configured."""
    global _session_factory
    if _session_factory is None:
        _init_engine()
    if _session_factory is None:
        yield None
        return
    async with _session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
