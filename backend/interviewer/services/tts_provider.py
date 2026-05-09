"""
Text-to-speech provider abstraction.
Phase 2 returns metadata + optional audio_url artifact.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote

from ..config import get_settings


@dataclass
class TTSResult:
    text: str
    provider: str
    voice: str
    audio_url: str | None = None
    mime_type: str | None = None


class BaseTTSProvider:
    provider_name = "base"

    async def synthesize(
        self,
        *,
        text: str,
        voice: str | None = None,
    ) -> TTSResult:
        raise NotImplementedError


class MockTTSProvider(BaseTTSProvider):
    """
    Fallback provider that returns a pseudo audio artifact URL.
    """

    provider_name = "mock"

    async def synthesize(
        self,
        *,
        text: str,
        voice: str | None = None,
    ) -> TTSResult:
        selected_voice = voice or "default"
        audio_url = f"mock://tts/{selected_voice}?q={quote(text[:180])}"
        return TTSResult(
            text=text,
            provider=self.provider_name,
            voice=selected_voice,
            audio_url=audio_url,
            mime_type="audio/mpeg",
        )


class ProviderTTSAdapter(MockTTSProvider):
    """
    Named adapter used when TTS_PROVIDER is configured.
    Real synthesis calls can replace this class in the same interface.
    """

    def __init__(self, provider_name: str) -> None:
        self.provider_name = provider_name


def get_tts_provider() -> BaseTTSProvider:
    settings = get_settings()
    provider = (settings.TTS_PROVIDER or "mock").lower()

    if provider in {"mock", "none"}:
        return MockTTSProvider()

    # For v1, keep route behavior stable while honoring provider config.
    return ProviderTTSAdapter(provider_name=provider)
