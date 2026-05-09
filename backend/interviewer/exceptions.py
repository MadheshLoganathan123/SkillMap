"""
Custom exception classes for the AI Interviewer module.
"""


class InterviewerError(Exception):
    """Base exception for the interviewer module."""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class SessionNotFoundError(InterviewerError):
    def __init__(self, session_id: str):
        super().__init__(f"Interview session '{session_id}' not found", 404)


class QuestionNotFoundError(InterviewerError):
    def __init__(self, question_id: str):
        super().__init__(f"Question '{question_id}' not found", 404)


class SessionAlreadyCompleteError(InterviewerError):
    def __init__(self, session_id: str):
        super().__init__(f"Session '{session_id}' is already completed", 400)


class AIServiceError(InterviewerError):
    def __init__(self, detail: str = "AI service unavailable"):
        super().__init__(f"AI service error: {detail}", 502)


class ResumeParsingError(InterviewerError):
    def __init__(self, detail: str = "Failed to parse resume"):
        super().__init__(f"Resume parsing error: {detail}", 422)


class AuthenticationError(InterviewerError):
    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(detail, 401)
