from __future__ import annotations

from datetime import datetime, timezone

from .db import get_connection
from .ml import calculate_priority, cluster_reports, estimate_people_affected


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def recluster_active_reports() -> None:
    connection = get_connection()
    active_reports = connection.execute(
        """
        SELECT *
        FROM reports
        WHERE status IN ('pending', 'acknowledged', 'in_progress')
        ORDER BY created_at ASC
        """
    ).fetchall()

    connection.execute("DELETE FROM clusters")
    connection.execute("UPDATE reports SET cluster_id = NULL")

    now = utc_now()

    for utility_type in ("electricity", "water"):
        type_reports = [dict(row) for row in active_reports if row["utility_type"] == utility_type]
        for items in cluster_reports(type_reports):
            center_latitude = sum(item["latitude"] for item in items) / len(items)
            center_longitude = sum(item["longitude"] for item in items) / len(items)
            report_count = len(items)
            estimated_people = estimate_people_affected(report_count, utility_type)
            priority_score = calculate_priority(items, utility_type)

            cursor = connection.execute(
                """
                INSERT INTO clusters (
                    utility_type,
                    status,
                    center_latitude,
                    center_longitude,
                    report_count,
                    estimated_people,
                    priority_score,
                    created_at,
                    updated_at
                ) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    utility_type,
                    center_latitude,
                    center_longitude,
                    report_count,
                    estimated_people,
                    priority_score,
                    now,
                    now,
                ),
            )
            cluster_id = cursor.lastrowid

            for item in items:
                connection.execute(
                    "UPDATE reports SET cluster_id = ?, updated_at = ? WHERE id = ?",
                    (cluster_id, now, item["id"]),
                )

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

    for report in reports:
        connection.execute(
            "UPDATE reports SET status = ?, updated_at = ? WHERE id = ?",
            (status, now, report["id"]),
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
