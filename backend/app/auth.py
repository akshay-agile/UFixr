from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone

from fastapi import Header, HTTPException

from .db import get_connection


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def create_session(user_id: int) -> str:
    token = str(uuid.uuid4())
    connection = get_connection()
    connection.execute(
        "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
        (token, user_id, utc_now()),
    )
    connection.commit()
    connection.close()
    return token


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid auth token.")

    token = authorization.replace("Bearer ", "", 1).strip()
    connection = get_connection()
    user = connection.execute(
        """
        SELECT users.id, users.phone, users.name
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ?
        """,
        (token,),
    ).fetchone()
    connection.close()

    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")

    return dict(user)
