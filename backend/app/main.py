from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .auth import create_session, get_current_user, hash_password
from .db import init_db, get_connection
from .schemas import (
    ClusterAssignmentRequest,
    ClusterStatusUpdateRequest,
    LoginRequest,
    RegisterRequest,
    ReportCreateRequest,
)
from .ml import analyze_cluster, analyze_stats, cluster_radius_from_count
from .services import (
    assign_cluster,
    cluster_stats_from_row,
    create_notification,
    get_cluster_stats,
    list_technicians,
    nearby_cluster_suggestions,
    recluster_active_reports,
    report_timeline,
    serialize_technician,
    sync_cluster_status,
    utc_now,
)

app = FastAPI(title="UFixr API", version="1.1.0")
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

ISSUE_LABELS = {
    "electricity": {
        "no_power": "No power at all",
        "flickering": "Power keeps flickering",
        "spark_smell": "Spark or burning smell",
        "dangerous_wire": "Loose wire or dangerous pole",
        "streetlight": "Streetlight issue",
    },
    "water": {
        "no_supply": "No water supply",
        "low_pressure": "Low water pressure",
        "leakage": "Water leakage",
        "dirty_water": "Dirty or contaminated water",
        "burst_pipe": "Burst pipe or flooding",
    },
}

IMPACT_LABELS = {
    "just_me": "Just my home",
    "few_homes": "A few homes",
    "whole_street": "Whole street or area",
    "dangerous_emergency": "Dangerous emergency",
}

ISSUE_SEVERITY = {
    "electricity": {
        "no_power": 4,
        "flickering": 3,
        "spark_smell": 5,
        "dangerous_wire": 5,
        "streetlight": 2,
    },
    "water": {
        "no_supply": 4,
        "low_pressure": 2,
        "leakage": 3,
        "dirty_water": 4,
        "burst_pipe": 5,
    },
}

IMPACT_BONUS = {
    "just_me": 0,
    "few_homes": 0,
    "whole_street": 1,
    "dangerous_emergency": 1,
}


def build_report_title(utility_type: str, issue_type: str, impact_level: str) -> str:
    issue_label = ISSUE_LABELS.get(utility_type, {}).get(issue_type, issue_type.replace("_", " ").title())
    impact_label = IMPACT_LABELS.get(impact_level, impact_level.replace("_", " ").title())
    return f"{issue_label} / {impact_label}"



def derive_severity(utility_type: str, issue_type: str, impact_level: str) -> int:
    base = ISSUE_SEVERITY.get(utility_type, {}).get(issue_type, 3)
    return min(base + IMPACT_BONUS.get(impact_level, 0), 5)


def parse_photo_field(value: str | None) -> tuple[list[str], str | None]:
    if not value:
        return [], None
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return [value], value
    if isinstance(parsed, list):
        cleaned = [str(item) for item in parsed if isinstance(item, str) and item]
        if not cleaned:
            return [], None
        return cleaned, cleaned[0]
    if isinstance(parsed, str) and parsed:
        return [parsed], parsed
    return [], None


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


@app.get("/technicians/options")
def technician_options(utility_type: str) -> dict:
    return {"items": list_technicians(utility_type)}


@app.get("/reports/suggestions")
def report_suggestions(utility_type: str, latitude: float, longitude: float) -> dict:
    return {
        "clusters": nearby_cluster_suggestions(utility_type, latitude, longitude),
        "technicians": list_technicians(utility_type)[:3],
    }


@app.post("/reports")
def create_report(payload: ReportCreateRequest, current_user: dict = Depends(get_current_user)) -> dict:
    connection = get_connection()
    now = utc_now()
    if payload.preferred_technician_id is not None:
        technician = connection.execute(
            "SELECT id FROM technicians WHERE id = ? AND active = 1",
            (payload.preferred_technician_id,),
        ).fetchone()
        if not technician:
            connection.close()
            raise HTTPException(status_code=400, detail="Preferred technician is not available.")

    severity = payload.severity if payload.severity is not None else derive_severity(payload.utility_type, payload.issue_type, payload.impact_level)
    title = payload.title.strip() or build_report_title(payload.utility_type, payload.issue_type, payload.impact_level)
    submitted_photos = [url for url in (payload.photo_urls or []) if url]
    if not submitted_photos and payload.photo_url:
        submitted_photos = [payload.photo_url]
    photo_payload = json.dumps(submitted_photos) if submitted_photos else None

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
            preferred_technician_id,
            issue_type,
            impact_level,
            status,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        """,
        (
            current_user["id"],
            payload.utility_type,
            title,
            payload.description,
            severity,
            payload.latitude,
            payload.longitude,
            photo_payload,
            payload.preferred_technician_id,
            payload.issue_type,
            payload.impact_level,
            now,
            now,
        ),
    )
    report_id = cursor.lastrowid
    connection.execute(
        """
        INSERT INTO report_events (report_id, cluster_id, status, title, detail, created_at)
        VALUES (?, NULL, 'pending', 'Report submitted', ?, ?)
        """,
        (report_id, "We received your utility fault report and queued it for clustering.", now),
    )
    connection.commit()
    connection.close()

    recluster_active_reports()

    connection = get_connection()
    report_row = connection.execute("SELECT cluster_id FROM reports WHERE id = ?", (report_id,)).fetchone()
    if payload.join_cluster_id and report_row and report_row["cluster_id"] == payload.join_cluster_id:
        connection.execute(
            """
            INSERT INTO report_events (report_id, cluster_id, status, title, detail, created_at)
            VALUES (?, ?, 'clustered', 'Joined existing outage', ?, ?)
            """,
            (report_id, payload.join_cluster_id, f"Your report strengthened cluster #{payload.join_cluster_id}.", utc_now()),
        )
        connection.commit()
    connection.close()

    create_notification(current_user["id"], report_id, "Report submitted", "We have received your utility fault report.")

    return {"id": report_id, "message": "Report created successfully."}


@app.get("/reports/me")
def my_reports(current_user: dict = Depends(get_current_user)) -> dict:
    connection = get_connection()
    rows = connection.execute(
        """
        SELECT reports.*, clusters.priority_score, clusters.report_count, clusters.estimated_people,
               clusters.technician_eta_minutes, clusters.assignment_note,
               technicians.id AS technician_id, technicians.name AS technician_name,
               technicians.phone AS technician_phone, technicians.rating AS technician_rating,
               technicians.specialization AS technician_specialization, technicians.zone AS technician_zone
        FROM reports
        LEFT JOIN clusters ON clusters.id = reports.cluster_id
        LEFT JOIN technicians ON technicians.id = clusters.technician_id
        WHERE reports.user_id = ?
        ORDER BY reports.created_at DESC
        """,
        (current_user["id"],),
    ).fetchall()

    items = []
    for row in rows:
        item = dict(row)
        photo_urls, primary_photo = parse_photo_field(item.get("photo_url"))
        item["photo_urls"] = photo_urls
        item["photo_url"] = primary_photo
        technician = None
        if row["technician_id"]:
            technician = {
                "id": row["technician_id"],
                "name": row["technician_name"],
                "phone": row["technician_phone"],
                "rating": row["technician_rating"],
                "specialization": row["technician_specialization"],
                "zone": row["technician_zone"],
                "eta_minutes": row["technician_eta_minutes"],
                "assignment_note": row["assignment_note"],
            }
        item["technician"] = technician
        item["timeline"] = report_timeline(connection, row["id"])
        items.append(item)

    connection.close()
    return {"items": items}


@app.get("/reports/nearby")
def nearby_reports(latitude: float, longitude: float, current_user: dict = Depends(get_current_user)) -> dict:
    del current_user
    connection = get_connection()
    cluster_rows = connection.execute(
        """
        SELECT clusters.*, reports.title AS top_title
        FROM clusters
        LEFT JOIN reports ON reports.cluster_id = clusters.id
        WHERE clusters.status != 'resolved'
        GROUP BY clusters.id
        ORDER BY clusters.priority_score DESC, clusters.updated_at DESC
        LIMIT 200
        """
    ).fetchall()

    cluster_ids = [row["id"] for row in cluster_rows]
    stats_map = get_cluster_stats(connection, cluster_ids)
    connection.close()

    items = []
    for row in cluster_rows:
        stats = stats_map.get(row["id"]) or cluster_stats_from_row(row)
        insights = analyze_stats(stats, row["utility_type"])
        items.append(
            {
                "id": row["id"],
                "utility_type": row["utility_type"],
                "title": row["top_title"] or f"{row['utility_type'].title()} issue cluster",
                "status": row["status"],
                "latitude": row["center_latitude"],
                "longitude": row["center_longitude"],
                "priority_score": row["priority_score"],
                "report_count": row["report_count"],
                "estimated_people": row["estimated_people"],
                "radius_meters": cluster_radius_from_count(row["report_count"] or 1),
                "estimated_resolution_minutes": insights.eta_minutes,
                "priority_reasons": insights.reasons,
                "priority_breakdown": insights.breakdown,
                "cluster_age_hours": round(stats.hours_open, 1),
            }
        )
    return {"items": items}


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


@app.get("/admin/technicians")
def admin_technicians(utility_type: str | None = None, cluster_id: int | None = None) -> dict:
    return {"items": list_technicians(utility_type, cluster_id)}


@app.get("/admin/clusters")
def admin_clusters() -> dict:
    connection = get_connection()
    rows = connection.execute(
        """
        SELECT clusters.*, technicians.id AS technician_id, technicians.name AS technician_name,
               technicians.phone AS technician_phone, technicians.rating AS technician_rating,
               technicians.specialization AS technician_specialization, technicians.zone AS technician_zone
        FROM clusters
        LEFT JOIN technicians ON technicians.id = clusters.technician_id
        ORDER BY CASE WHEN clusters.status = 'resolved' THEN 1 ELSE 0 END, clusters.priority_score DESC, clusters.updated_at DESC
        """
    ).fetchall()
    reports = connection.execute(
        """
        SELECT reports.id, reports.cluster_id, reports.title, reports.status, reports.utility_type,
               reports.created_at, reports.photo_url, reports.severity, reports.preferred_technician_id,
               reports.issue_type, reports.impact_level
        FROM reports
        WHERE reports.cluster_id IS NOT NULL
        ORDER BY reports.created_at DESC
        """
    ).fetchall()

    report_map: dict[int, list[dict]] = {}
    for row in reports:
        report_dict = dict(row)
        photo_urls, primary_photo = parse_photo_field(report_dict.get("photo_url"))
        report_dict["photo_urls"] = photo_urls
        report_dict["photo_url"] = primary_photo
        report_map.setdefault(row["cluster_id"], []).append(report_dict)

    items = []
    for row in rows:
        report_items = report_map.get(row["id"], [])
        item = dict(row)
        item["reports"] = report_items
        item["technician"] = serialize_technician(row) | {"eta_minutes": row["technician_eta_minutes"], "assignment_note": row["assignment_note"]} if row["technician_id"] else None
        if report_items:
            insights = analyze_cluster(report_items, row["utility_type"])
        else:
            stats = cluster_stats_from_row(row)
            insights = analyze_stats(stats, row["utility_type"])

        item["priority_reasons"] = insights.reasons
        item["estimated_resolution_minutes"] = insights.eta_minutes
        item["analytics"] = {
            "eta_minutes": insights.eta_minutes,
            "breakdown": insights.breakdown,
            "hours_open": round(insights.stats.hours_open, 1),
            "hours_since_last": round(insights.stats.hours_since_last, 1),
        }
        item["radius_meters"] = cluster_radius_from_count(row["report_count"] or 1)
        item["technician_options"] = list_technicians(row["utility_type"], row["id"])[:3]
        items.append(item)

    connection.close()
    return {"items": items}


@app.post("/admin/clusters/{cluster_id}/assign")
def assign_cluster_endpoint(cluster_id: int, payload: ClusterAssignmentRequest) -> dict:
    connection = get_connection()
    cluster = connection.execute("SELECT id FROM clusters WHERE id = ?", (cluster_id,)).fetchone()
    connection.close()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found.")

    try:
        technician = assign_cluster(cluster_id, payload.technician_id, payload.eta_minutes, payload.note)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return {"message": "Cluster assigned.", "technician": technician}


@app.patch("/admin/clusters/{cluster_id}/status")
def update_cluster_status(cluster_id: int, payload: ClusterStatusUpdateRequest) -> dict:
    connection = get_connection()
    cluster = connection.execute("SELECT id FROM clusters WHERE id = ?", (cluster_id,)).fetchone()
    connection.close()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found.")

    sync_cluster_status(cluster_id, payload.status)
    return {"message": "Cluster updated."}
