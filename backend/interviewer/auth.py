"""
JWT authentication dependency using Supabase token verification.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .db import get_supabase

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """
    Verify the Supabase JWT and return the user object.
    Falls back to anonymous access when no token is provided
    (useful during development; tighten in production).
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        db = get_supabase()
        user_response = db.auth.get_user(token)
        if not user_response or not user_response.user:
            raise ValueError("Invalid user response")
        return {
            "id": str(user_response.user.id),
            "email": user_response.user.email,
            "role": user_response.user.role,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict | None:
    """
    Same as get_current_user but returns None instead of raising
    when no token is provided. Useful for endpoints that support
    both authenticated and anonymous access.
    """
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
