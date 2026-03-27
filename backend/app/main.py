from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .auth import create_session, get_current_user, hash_password
from .db import init_db, get_connection
from .schemas import ClusterStatusUpdateRequest, LoginRequest, RegisterRequest, ReportCreateRequest
from .services import create_notification, recluster_active_reports, sync_cluster_status, utc_now

app = FastAPI(title="UtilityWatch API", version="1.0.0")
uploads_dir = Path(__file__).resolve().parent / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/auth/register")
def register(payload: RegisterRequest) -> dict:
    connection = get_connection()
    existing = connection.execute("SELECT id FROM users WHERE phone = ?", (payload.phone,)).fetchone()
    if existing:
        connection.close()
        raise HTTPException(status_code=400, detail="Phone number already registered.")

    cursor = connection.execute(
        """
        INSERT INTO users (phone, password_hash, name, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (payload.phone, hash_password(payload.password), payload.name, utc_now()),
    )
    user_id = cursor.lastrowid
    connection.commit()
    connection.close()

    token = create_session(user_id)
    return {"token": token, "user": {"id": user_id, "name": payload.name, "phone": payload.phone}}


@app.post("/auth/login")
def login(payload: LoginRequest) -> dict:
    connection = get_connection()
    user = connection.execute(
        "SELECT id, phone, name, password_hash FROM users WHERE phone = ?",
        (payload.phone,),
    ).fetchone()
    connection.close()

    if not user or user["password_hash"] != hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid phone or password.")

    token = create_session(user["id"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "phone": user["phone"]}}


@app.post("/upload")
def upload_photo(request: Request, file: UploadFile = File(...)) -> dict:
    extension = Path(file.filename or "image.jpg").suffix or ".jpg"
    file_name = f"{uuid.uuid4()}{extension}"
    destination = uploads_dir / file_name
    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"photo_url": str(request.base_url).rstrip("/") + f"/uploads/{file_name}"}


@app.get("/me")
def me(current_user: dict = Depends(get_current_user)) -> dict:
    return {"user": current_user}


@app.post("/reports")
def create_report(payload: ReportCreateRequest, current_user: dict = Depends(get_current_user)) -> dict:
    connection = get_connection()
    now = utc_now()
    cursor = connection.execute(
        """
        INSERT INTO reports (
            user_id,
            utility_type,
            title,
            description,
            severity,
            latitude,
            longitude,
            photo_url,
            status,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        """,
        (
            current_user["id"],
            payload.utility_type,
            payload.title,
            payload.description,
            payload.severity,
            payload.latitude,
            payload.longitude,
            payload.photo_url,
            now,
            now,
        ),
    )
    report_id = cursor.lastrowid
    connection.commit()
    connection.close()

    recluster_active_reports()
    create_notification(current_user["id"], report_id, "Report submitted", "We have received your utility fault report.")

    return {"id": report_id, "message": "Report created successfully."}


@app.get("/reports/me")
def my_reports(current_user: dict = Depends(get_current_user)) -> dict:
    connection = get_connection()
    rows = connection.execute(
        """
        SELECT reports.*, clusters.priority_score, clusters.report_count
        FROM reports
        LEFT JOIN clusters ON clusters.id = reports.cluster_id
        WHERE reports.user_id = ?
        ORDER BY reports.created_at DESC
        """,
        (current_user["id"],),
    ).fetchall()
    connection.close()
    return {"items": [dict(row) for row in rows]}


@app.get("/reports/nearby")
def nearby_reports(latitude: float, longitude: float, current_user: dict = Depends(get_current_user)) -> dict:
    del current_user, latitude, longitude
    connection = get_connection()
    rows = connection.execute(
        """
        SELECT reports.id, reports.utility_type, reports.title, reports.status,
               reports.latitude, reports.longitude, reports.severity,
               clusters.priority_score, clusters.report_count
        FROM reports
        LEFT JOIN clusters ON clusters.id = reports.cluster_id
        WHERE reports.status != 'resolved'
        ORDER BY reports.created_at DESC
        LIMIT 200
        """
    ).fetchall()
    connection.close()
    return {"items": [dict(row) for row in rows]}


@app.get("/notifications")
def notifications(current_user: dict = Depends(get_current_user)) -> dict:
    connection = get_connection()
    rows = connection.execute(
        """
        SELECT id, title, message, is_read, created_at
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        """,
        (current_user["id"],),
    ).fetchall()
    connection.close()
    return {"items": [dict(row) for row in rows]}


@app.get("/admin/clusters")
def admin_clusters() -> dict:
    connection = get_connection()
    rows = connection.execute(
        """
        SELECT *
        FROM clusters
        ORDER BY CASE WHEN status = 'resolved' THEN 1 ELSE 0 END, priority_score DESC, updated_at DESC
        """
    ).fetchall()
    reports = connection.execute(
        """
        SELECT reports.id, reports.cluster_id, reports.title, reports.status, reports.utility_type,
               reports.created_at, reports.photo_url, reports.severity
        FROM reports
        WHERE reports.cluster_id IS NOT NULL
        ORDER BY reports.created_at DESC
        """
    ).fetchall()
    connection.close()

    report_map: dict[int, list[dict]] = {}
    for row in reports:
        report_map.setdefault(row["cluster_id"], []).append(dict(row))

    items = []
    for row in rows:
        item = dict(row)
        item["reports"] = report_map.get(row["id"], [])
        items.append(item)

    return {"items": items}


@app.patch("/admin/clusters/{cluster_id}/status")
def update_cluster_status(cluster_id: int, payload: ClusterStatusUpdateRequest) -> dict:
    connection = get_connection()
    cluster = connection.execute("SELECT id FROM clusters WHERE id = ?", (cluster_id,)).fetchone()
    connection.close()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found.")

    sync_cluster_status(cluster_id, payload.status)
    return {"message": "Cluster updated."}
