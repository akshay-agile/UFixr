from __future__ import annotations

from datetime import datetime, timezone
from math import radians

import numpy as np
from sklearn.cluster import DBSCAN

EARTH_RADIUS_METERS = 6_371_000


def cluster_reports(rows: list[dict]) -> list[list[dict]]:
    if not rows:
        return []

    coords = np.array([[radians(item["latitude"]), radians(item["longitude"])] for item in rows])
    epsilon = 300 / EARTH_RADIUS_METERS
    model = DBSCAN(eps=epsilon, min_samples=3, algorithm="ball_tree", metric="haversine")
    labels = model.fit_predict(coords)

    grouped: dict[int, list[dict]] = {}
    for row, label in zip(rows, labels):
        grouped.setdefault(int(label), []).append(row)

    clusters: list[list[dict]] = []
    for label, items in grouped.items():
        if label == -1:
            for item in items:
                clusters.append([item])
        else:
            clusters.append(items)

    return clusters


def calculate_priority(cluster_reports_: list[dict], utility_type: str) -> float:
    report_count = len(cluster_reports_)
    severity_average = sum(item["severity"] for item in cluster_reports_) / report_count
    created_times = [
        datetime.fromisoformat(item["created_at"].replace("Z", "+00:00")) for item in cluster_reports_
    ]
    age_hours = max((datetime.now(timezone.utc) - min(created_times)).total_seconds() / 3600, 0)

    count_factor = min(report_count / 10, 1.0) * 35
    severity_factor = (severity_average / 5) * 25
    age_factor = min(age_hours / 6, 1.0) * 20
    utility_factor = 20 if utility_type == "electricity" else 12
    return round(min(count_factor + severity_factor + age_factor + utility_factor, 100), 2)


def estimate_people_affected(report_count: int, utility_type: str) -> int:
    multiplier = 650 if utility_type == "electricity" else 450
    return report_count * multiplier
