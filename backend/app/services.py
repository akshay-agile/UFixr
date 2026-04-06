from __future__ import annotations

from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt

from .db import get_connection
from .ml import (
    ClusterStats,
    analyze_cluster,
    analyze_stats,
    build_stats_from_aggregates,
    cluster_radius_from_count,
    cluster_reports,
    estimate_people_affected,
)

EARTH_RADIUS_METERS = 6_371_000
MATCH_DISTANCE_METERS = 450
SUGGESTION_DISTANCE_METERS = 650


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1_r, lon1_r, lat2_r, lon2_r = map(radians, (lat1, lon1, lat2, lon2))
    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r
    hav = sin(dlat / 2) ** 2 + cos(lat1_r) * cos(lat2_r) * sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * asin(sqrt(hav))


def create_notification(user_id: int, report_id: int | None, title: str, message: str) -> None:
    connection = get_connection()
    connection.execute(
        """
        INSERT INTO notifications (user_id, report_id, title, message, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (user_id, report_id, title, message, utc_now()),
    )
    connection.commit()
    connection.close()


def _row_value(row, primary: str, fallback: str):
    try:
        return row[primary]
    except Exception:
        return row[fallback]


def serialize_technician(row) -> dict | None:
    if not row:
        return None
    try:
        technician_id = row["technician_id"]
    except Exception:
        technician_id = row["id"]
    if not technician_id:
        return None
    return {
        "id": technician_id,
        "name": _row_value(row, "technician_name", "name"),
        "phone": _row_value(row, "technician_phone", "phone"),
        "rating": _row_value(row, "technician_rating", "rating"),
        "specialization": _row_value(row, "technician_specialization", "specialization"),
        "zone": _row_value(row, "technician_zone", "zone"),
    }


def record_report_event(
    connection,
    report_id: int,
    cluster_id: int | None,
    status: str,
    title: str,
    detail: str,
    created_at: str | None = None,
) -> None:
    timestamp = created_at or utc_now()
    latest = connection.execute(
        """
        SELECT status, title, detail
        FROM report_events
        WHERE report_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        """,
        (report_id,),
    ).fetchone()
    if latest and latest["status"] == status and latest["title"] == title and latest["detail"] == detail:
        return

    connection.execute(
        """
        INSERT INTO report_events (report_id, cluster_id, status, title, detail, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (report_id, cluster_id, status, title, detail, timestamp),
    )


def list_technicians(utility_type: str | None = None, cluster_id: int | None = None) -> list[dict]:
    connection = get_connection()
    try:
        return _technician_options(connection, utility_type, cluster_id)
    finally:
        connection.close()


def _technician_options(connection, utility_type: str | None, cluster_id: int | None = None) -> list[dict]:
    preference_counts: dict[int, int] = {}
    if cluster_id is not None:
        rows = connection.execute(
            """
            SELECT preferred_technician_id, COUNT(*) AS votes
            FROM reports
            WHERE cluster_id = ? AND preferred_technician_id IS NOT NULL
            GROUP BY preferred_technician_id
            """,
            (cluster_id,),
        ).fetchall()
        preference_counts = {row["preferred_technician_id"]: row["votes"] for row in rows}

    if utility_type is None:
        rows = connection.execute(
            "SELECT * FROM technicians WHERE active = 1 ORDER BY rating DESC, name ASC"
        ).fetchall()
    else:
        rows = connection.execute(
            """
            SELECT *
            FROM technicians
            WHERE active = 1 AND specialization IN (?, 'general')
            ORDER BY CASE WHEN specialization = ? THEN 0 ELSE 1 END, rating DESC, name ASC
            """,
            (utility_type, utility_type),
        ).fetchall()

    options = []
    for row in rows:
        item = serialize_technician(row)
        item["preferred_count"] = preference_counts.get(row["id"], 0)
        options.append(item)
    return options


def recluster_active_reports() -> None:
    connection = get_connection()
    active_reports = connection.execute(
        """
        SELECT *
        FROM reports
        WHERE status IN ('pending', 'acknowledged', 'assigned', 'in_progress')
        ORDER BY created_at ASC
        """
    ).fetchall()
    existing_clusters = [dict(row) for row in connection.execute("SELECT * FROM clusters").fetchall()]

    now = utc_now()
    retained_cluster_ids: set[int] = set()
    assigned_report_ids: set[int] = set()

    for utility_type in ("electricity", "water"):
        type_reports = [dict(row) for row in active_reports if row["utility_type"] == utility_type]
        for items in cluster_reports(type_reports):
            center_latitude = sum(item["latitude"] for item in items) / len(items)
            center_longitude = sum(item["longitude"] for item in items) / len(items)
            report_count = len(items)
            insights = analyze_cluster(items, utility_type)
            estimated_people = estimate_people_affected(report_count, utility_type, insights.stats.avg_severity)
            priority_score = insights.score

            best_match = None
            best_distance = None
            for cluster in existing_clusters:
                if cluster["id"] in retained_cluster_ids or cluster["utility_type"] != utility_type:
                    continue
                current_distance = distance_meters(
                    center_latitude,
                    center_longitude,
                    cluster["center_latitude"],
                    cluster["center_longitude"],
                )
                if current_distance <= MATCH_DISTANCE_METERS and (best_distance is None or current_distance < best_distance):
                    best_match = cluster
                    best_distance = current_distance

            if best_match:
                cluster_id = best_match["id"]
                status = best_match["status"] if best_match["status"] != "resolved" else "pending"
                connection.execute(
                    """
                    UPDATE clusters
                    SET status = ?, center_latitude = ?, center_longitude = ?, report_count = ?,
                        estimated_people = ?, priority_score = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (status, center_latitude, center_longitude, report_count, estimated_people, priority_score, now, cluster_id),
                )
            else:
                status = "pending"
                cursor = connection.execute(
                    """
                    INSERT INTO clusters (
                        utility_type, status, center_latitude, center_longitude, report_count,
                        estimated_people, priority_score, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (utility_type, status, center_latitude, center_longitude, report_count, estimated_people, priority_score, now, now),
                )
                cluster_id = cursor.lastrowid

            retained_cluster_ids.add(cluster_id)
            cluster_status = connection.execute("SELECT status FROM clusters WHERE id = ?", (cluster_id,)).fetchone()["status"]
            cluster_detail = f"Grouped into outage cluster #{cluster_id} with {report_count} report{'s' if report_count != 1 else ''}."
            for item in items:
                assigned_report_ids.add(item["id"])
                previous_cluster_id = item["cluster_id"]
                previous_status = item["status"]
                next_status = cluster_status if cluster_status in ("assigned", "in_progress") else previous_status
                connection.execute(
                    "UPDATE reports SET cluster_id = ?, status = ?, updated_at = ? WHERE id = ?",
                    (cluster_id, next_status, now, item["id"]),
                )
                if previous_cluster_id != cluster_id:
                    record_report_event(connection, item["id"], cluster_id, "clustered", "Cluster detected", cluster_detail, now)

    if retained_cluster_ids:
        placeholders = ",".join("?" for _ in retained_cluster_ids)
        connection.execute(
            f"DELETE FROM clusters WHERE id NOT IN ({placeholders}) AND id NOT IN (SELECT DISTINCT cluster_id FROM reports WHERE cluster_id IS NOT NULL)",
            tuple(retained_cluster_ids),
        )
    else:
        connection.execute("DELETE FROM clusters WHERE id NOT IN (SELECT DISTINCT cluster_id FROM reports WHERE cluster_id IS NOT NULL)")

    connection.commit()
    connection.close()


def sync_cluster_status(cluster_id: int, status: str) -> None:
    connection = get_connection()
    now = utc_now()

    connection.execute(
        "UPDATE clusters SET status = ?, updated_at = ? WHERE id = ?",
        (status, now, cluster_id),
    )
    reports = connection.execute(
        "SELECT id, user_id FROM reports WHERE cluster_id = ?",
        (cluster_id,),
    ).fetchall()

    label = status.replace("_", " ").title()
    for report in reports:
        connection.execute(
            "UPDATE reports SET status = ?, updated_at = ? WHERE id = ?",
            (status, now, report["id"]),
        )
        record_report_event(
            connection,
            report["id"],
            cluster_id,
            status,
            f"Status changed to {label}",
            f"The cluster is now marked as {status.replace('_', ' ')}.",
            now,
        )
        connection.execute(
            """
            INSERT INTO notifications (user_id, report_id, title, message, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                report["user_id"],
                report["id"],
                "Utility status update",
                f"Your report is now marked as {status.replace('_', ' ')}.",
                now,
            ),
        )

    connection.commit()
    connection.close()


def assign_cluster(cluster_id: int, technician_id: int, eta_minutes: int, note: str) -> dict:
    connection = get_connection()
    now = utc_now()
    technician = connection.execute("SELECT * FROM technicians WHERE id = ? AND active = 1", (technician_id,)).fetchone()
    if not technician:
        connection.close()
        raise ValueError("Technician not found.")

    connection.execute(
        """
        UPDATE clusters
        SET technician_id = ?, technician_eta_minutes = ?, assignment_note = ?, status = 'assigned', updated_at = ?
        WHERE id = ?
        """,
        (technician_id, eta_minutes, note, now, cluster_id),
    )
    reports = connection.execute(
        "SELECT id, user_id FROM reports WHERE cluster_id = ?",
        (cluster_id,),
    ).fetchall()

    detail_suffix = f" Assigned to {technician['name']} ({technician['rating']:.1f}/5), ETA {eta_minutes} min."
    if note:
        detail_suffix += f" Note: {note}"

    for report in reports:
        connection.execute(
            "UPDATE reports SET status = 'assigned', updated_at = ? WHERE id = ?",
            (now, report["id"]),
        )
        record_report_event(
            connection,
            report["id"],
            cluster_id,
            "assigned",
            "Technician assigned",
            detail_suffix.strip(),
            now,
        )
        connection.execute(
            """
            INSERT INTO notifications (user_id, report_id, title, message, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                report["user_id"],
                report["id"],
                "Technician assigned",
                f"{technician['name']} is assigned to your area. ETA {eta_minutes} minutes.",
                now,
            ),
        )

    connection.commit()
    result = serialize_technician(technician)
    connection.close()
    return result


def report_timeline(connection, report_id: int) -> list[dict]:
    rows = connection.execute(
        """
        SELECT status, title, detail, created_at
        FROM report_events
        WHERE report_id = ?
        ORDER BY created_at ASC, id ASC
        """,
        (report_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def nearby_cluster_suggestions(utility_type: str, latitude: float, longitude: float) -> list[dict]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT clusters.*, reports.title AS top_title
            FROM clusters
            LEFT JOIN reports ON reports.cluster_id = clusters.id
            WHERE clusters.utility_type = ? AND clusters.status != 'resolved'
            GROUP BY clusters.id
            ORDER BY clusters.priority_score DESC, clusters.updated_at DESC
            """,
            (utility_type,),
        ).fetchall()
        cluster_ids = [row["id"] for row in rows]
        stats_map = get_cluster_stats(connection, cluster_ids)
        suggestions = []
        for row in rows:
            current_distance = distance_meters(latitude, longitude, row["center_latitude"], row["center_longitude"])
            if current_distance <= SUGGESTION_DISTANCE_METERS:
                stats = stats_map.get(row["id"]) or cluster_stats_from_row(row)
                insights = analyze_stats(stats, row["utility_type"])
                suggestions.append(
                    {
                        "id": row["id"],
                        "title": row["top_title"] or f"{utility_type.title()} issue cluster",
                        "status": row["status"],
                        "report_count": row["report_count"],
                        "priority_score": row["priority_score"],
                        "distance_meters": round(current_distance),
                        "estimated_resolution_minutes": insights.eta_minutes,
                        "priority_reasons": insights.reasons,
                        "radius_meters": cluster_radius_from_count(row["report_count"] or 1),
                    }
                )
        return sorted(suggestions, key=lambda item: item["distance_meters"])[:3]
    finally:
        connection.close()


def get_cluster_stats(connection, cluster_ids: list[int]) -> dict[int, ClusterStats]:
    if not cluster_ids:
        return {}
    placeholders = ",".join("?" for _ in cluster_ids)
    rows = connection.execute(
        f"""
        SELECT cluster_id,
               COUNT(*) AS report_count,
               AVG(severity) AS avg_severity,
               MIN(created_at) AS first_report_at,
               MAX(created_at) AS last_report_at,
               SUM(CASE WHEN issue_type IN ('dangerous_wire','spark_smell','burst_pipe') THEN 1 ELSE 0 END) AS hazard_reports,
               SUM(CASE WHEN impact_level IN ('whole_street','dangerous_emergency') THEN 1 ELSE 0 END) AS emergency_reports
        FROM reports
        WHERE cluster_id IN ({placeholders})
        GROUP BY cluster_id
        """,
        tuple(cluster_ids),
    ).fetchall()

    stats_map: dict[int, ClusterStats] = {}
    for row in rows:
        stats_map[row["cluster_id"]] = build_stats_from_aggregates(
            report_count=row["report_count"],
            avg_severity=row["avg_severity"],
            first_report_at=row["first_report_at"],
            last_report_at=row["last_report_at"],
            hazard_reports=row["hazard_reports"],
            emergency_reports=row["emergency_reports"],
        )
    return stats_map


def cluster_stats_from_row(row) -> ClusterStats:
    return ClusterStats(
        report_count=row["report_count"] or 1,
        avg_severity=3.0,
        hours_open=0.0,
        hours_since_last=0.0,
        hazard_ratio=0.0,
        emergency_ratio=0.0,
    )
