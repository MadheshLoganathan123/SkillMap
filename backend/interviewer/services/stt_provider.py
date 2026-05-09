"""
Speech-to-text provider abstraction.
Phase 2 uses provider selection via env and a safe fallback adapter.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..config import get_settings


@dataclass
class TranscriptResult:
    transcript: str
    confidence: float
    is_final: bool
    provider: str


class BaseSTTProvider:
    provider_name = "base"

    async def transcribe_chunk(
        self,
        *,
        session_id: str,
        chunk: str,
        is_final: bool = False,
    ) -> TranscriptResult:
        raise NotImplementedError


class MockSTTProvider(BaseSTTProvider):
    """
    Placeholder STT adapter for websocket plumbing.
    Treats incoming chunk text as already-transcribed content.
    """

    provider_name = "mock"

    async def transcribe_chunk(
        self,
        *,
        session_id: str,
        chunk: str,
        is_final: bool = False,
    ) -> TranscriptResult:
        confidence = 0.9 if chunk.strip() else 0.0
        return TranscriptResult(
            transcript=chunk.strip(),
            confidence=confidence,
            is_final=is_final,
            provider=self.provider_name,
        )


class ProviderSTTAdapter(MockSTTProvider):
    """
    Named adapter used when STT_PROVIDER is configured.
    Real API calls can replace this class without changing route logic.
    """

    def __init__(self, provider_name: str) -> None:
        self.provider_name = provider_name


def get_stt_provider() -> BaseSTTProvider:
    settings = get_settings()
    provider = (settings.STT_PROVIDER or "mock").lower()

    if provider in {"mock", "none"}:
        return MockSTTProvider()

    # For v1, keep non-breaking behavior while honoring env selection.
    return ProviderSTTAdapter(provider_name=provider)
