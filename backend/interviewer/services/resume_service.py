"""
Resume upload, text extraction, and skill identification for
interview context generation.
"""

from __future__ import annotations

import os
import shutil
import tempfile
import traceback
from pathlib import Path

from ..exceptions import ResumeParsingError


async def extract_resume_text(file_bytes: bytes, filename: str) -> str:
    """
    Extract plain text from a PDF resume.
    Uses pdfplumber for robust extraction.
    """
    suffix = Path(filename).suffix.lower()
    if suffix != ".pdf":
        raise ResumeParsingError(f"Unsupported file type '{suffix}'. Only PDF is supported.")

    tmp_dir = Path(tempfile.gettempdir()) / "skillmap_uploads"
    tmp_dir.mkdir(exist_ok=True)
    tmp_path = tmp_dir / filename

    try:
        tmp_path.write_bytes(file_bytes)

        import pdfplumber  # lazy import to avoid startup cost
        text_parts: list[str] = []
        with pdfplumber.open(str(tmp_path)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)

        if not text_parts:
            raise ResumeParsingError("Could not extract any text from the PDF.")

        return "\n\n".join(text_parts)

    except ResumeParsingError:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise ResumeParsingError(f"PDF processing failed: {exc}")
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)


def extract_skills_from_text(text: str) -> list[str]:
    """
    Quick keyword-based skill extraction from resume text.
    For production use, the AI service can do deeper analysis.
    """
    # Common technical skill keywords
    skill_keywords = {
        "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust",
        "react", "angular", "vue", "next.js", "node.js", "express", "django",
        "flask", "fastapi", "spring", "docker", "kubernetes", "aws", "azure",
        "gcp", "terraform", "ci/cd", "git", "sql", "postgresql", "mongodb",
        "redis", "graphql", "rest", "api", "microservices", "agile", "scrum",
        "machine learning", "deep learning", "nlp", "tensorflow", "pytorch",
        "pandas", "numpy", "data science", "data analysis", "tableau",
        "power bi", "figma", "html", "css", "sass", "tailwind",
        "linux", "bash", "powershell", "networking", "security",
        "blockchain", "solidity", "web3",
    }

    text_lower = text.lower()
    found: list[str] = []
    for skill in skill_keywords:
        if skill in text_lower:
            found.append(skill)

    return sorted(set(found))
