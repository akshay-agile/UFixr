from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Iterable, Sequence

import numpy as np
from sklearn.cluster import DBSCAN

EARTH_RADIUS_METERS = 6_371_000
_HAZARDOUS_ISSUES = {"dangerous_wire", "spark_smell", "burst_pipe"}


@dataclass
class ClusterStats:
    report_count: int
    avg_severity: float
    hours_open: float
    hours_since_last: float
    hazard_ratio: float
    emergency_ratio: float


@dataclass
class ClusterInsights:
    score: float
    reasons: list[str]
    breakdown: dict[str, float]
    eta_minutes: int
    stats: ClusterStats


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        ts = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _hours_since(value: str | datetime | None) -> float:
    timestamp = _parse_timestamp(value) if not isinstance(value, datetime) else value
    if not timestamp:
        return 0.0
    return max((datetime.now(timezone.utc) - timestamp).total_seconds() / 3600, 0.0)


def _dynamic_eps_meters(rows: Sequence[dict]) -> float:
    if not rows:
        return 280.0
    ages = np.array([_hours_since(row.get("created_at")) for row in rows])
    recency = np.clip(np.exp(-ages / 18), 0.45, 1.0)
    severity = np.array([row.get("severity", 3) for row in rows])
    severity_factor = np.clip(severity.mean() / 4, 0.6, 1.2)
    density_factor = np.clip(len(rows) / 24, 0.7, 1.4)
    base = 260.0 * float(recency.mean()) * severity_factor
    if len(rows) <= 5:
        base *= 0.9
    if len(rows) >= 30:
        base *= 1.15
    meters = base * density_factor
    return float(np.clip(meters, 140.0, 620.0))


def _min_samples_for(rows: Sequence[dict]) -> int:
    n = len(rows)
    if n <= 4:
        return 1
    if n <= 10:
        return 2
    if n <= 30:
        return 3
    return 4


def cluster_reports(rows: list[dict]) -> list[list[dict]]:
    if not rows:
        return []

    coords = np.array([[radians(item["latitude"]), radians(item["longitude"])] for item in rows])
    epsilon = _dynamic_eps_meters(rows) / EARTH_RADIUS_METERS
    model = DBSCAN(eps=epsilon, min_samples=_min_samples_for(rows), algorithm="ball_tree", metric="haversine")

    ages = np.array([_hours_since(row.get("created_at")) for row in rows])
    severities = np.array([row.get("severity", 3) for row in rows])
    weights = np.clip(np.exp(-ages / 24), 0.35, 1.0) + (np.clip(severities, 1, 5) / 5) * 0.25
    model.fit(coords, sample_weight=weights)
    labels = model.labels_

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


def _calc_hours(values: Iterable[str | datetime | None], reducer) -> float:
    timestamps = [t for t in (_parse_timestamp(value) for value in values) if t]
    if not timestamps:
        return 0.0
    target = reducer(timestamps)
    return _hours_since(target)


def build_stats_from_rows(rows: Sequence[dict]) -> ClusterStats:
    report_count = max(len(rows), 1)
    avg_severity = float(np.mean([row.get("severity", 3) for row in rows]))
    hours_since_first = _calc_hours((row.get("created_at") for row in rows), min)
    hours_since_last = _calc_hours((row.get("created_at") for row in rows), max)
    hazard_ratio = sum(1 for row in rows if row.get("issue_type") in _HAZARDOUS_ISSUES) / report_count
    emergency_ratio = sum(1 for row in rows if row.get("impact_level") in ("whole_street", "dangerous_emergency")) / report_count
    return ClusterStats(
        report_count=report_count,
        avg_severity=avg_severity,
        hours_open=hours_since_first,
        hours_since_last=hours_since_last,
        hazard_ratio=hazard_ratio,
        emergency_ratio=emergency_ratio,
    )


def build_stats_from_aggregates(
    report_count: int,
    avg_severity: float | None,
    first_report_at: str | None,
    last_report_at: str | None,
    hazard_reports: int | None,
    emergency_reports: int | None,
) -> ClusterStats:
    count = max(report_count, 1)
    hours_open = _hours_since(first_report_at)
    hours_since_last = _hours_since(last_report_at)
    hazard_ratio = (hazard_reports or 0) / count
    emergency_ratio = (emergency_reports or 0) / count
    return ClusterStats(
        report_count=count,
        avg_severity=float(avg_severity or 3.0),
        hours_open=hours_open,
        hours_since_last=hours_since_last,
        hazard_ratio=hazard_ratio,
        emergency_ratio=emergency_ratio,
    )


def _score_from_components(components: dict[str, float]) -> tuple[float, dict[str, float]]:
    weights = {
        "severity": 0.32,
        "density": 0.26,
        "recency": 0.2,
        "hazard": 0.12,
        "infrastructure": 0.1,
    }
    score = 0.0
    breakdown: dict[str, float] = {}
    for key, value in components.items():
        weighted = value * weights[key]
        score += weighted
        breakdown[key] = round(value * 100, 1)
    return float(np.clip(score * 100, 1, 100)), breakdown


def analyze_stats(stats: ClusterStats, utility_type: str) -> ClusterInsights:
    severity_component = np.clip(stats.avg_severity / 5, 0.2, 1.0)
    density_component = np.clip(stats.report_count / 10, 0.25, 1.2)
    recency_component = np.clip(1 - stats.hours_since_last / 8, 0.1, 1.0)
    hazard_component = np.clip(stats.hazard_ratio * 1.3 + stats.emergency_ratio * 0.7, 0.0, 1.0)
    infrastructure_component = 1.0 if utility_type == "electricity" else 0.85

    components = {
        "severity": severity_component,
        "density": density_component,
        "recency": recency_component,
        "hazard": hazard_component,
        "infrastructure": infrastructure_component,
    }
    score, breakdown = _score_from_components(components)
    eta_minutes = estimate_resolution_minutes(stats, utility_type)
    reasons = _reasons_from_stats(stats, score)
    return ClusterInsights(score=score, reasons=reasons, breakdown=breakdown, eta_minutes=eta_minutes, stats=stats)


def _reasons_from_stats(stats: ClusterStats, score: float) -> list[str]:
    reasons: list[str] = []
    if stats.report_count >= 5:
        reasons.append(f"{stats.report_count} citizen reports in one zone")
    elif stats.report_count >= 3:
        reasons.append("Repeated pings from neighbors")
    if stats.avg_severity >= 4.2:
        reasons.append("Severe outage pattern")
    elif stats.avg_severity >= 3.5:
        reasons.append("Moderate-to-high severity")
    if stats.hours_since_last <= 1.5:
        reasons.append("Fresh incident wave")
    if stats.hazard_ratio >= 0.3:
        reasons.append("Hazardous issue mentions")
    if stats.emergency_ratio >= 0.4:
        reasons.append("Area-wide impact")
    if not reasons:
        reasons.append("Monitoring due to civic impact")
    if score >= 80:
        reasons.insert(0, "Critical queue candidate")
    return reasons[:4]


def analyze_cluster(rows: Sequence[dict], utility_type: str) -> ClusterInsights:
    stats = build_stats_from_rows(rows)
    return analyze_stats(stats, utility_type)


def estimate_resolution_minutes(stats: ClusterStats, utility_type: str) -> int:
    base = 200 if utility_type == "water" else 170
    severity_pull = (stats.avg_severity - 2.5) * 25
    density_pull = stats.report_count * 6
    freshness_bonus = max(0, 40 - stats.hours_since_last * 5)
    hazard_pull = stats.hazard_ratio * 40 + stats.emergency_ratio * 30
    eta = base - severity_pull - density_pull - freshness_bonus - hazard_pull
    eta = np.clip(eta, 35, 360)
    return int(round(float(eta)))


def estimate_people_affected(report_count: int, utility_type: str, average_severity: float = 3.0) -> int:
    base_multiplier = 520 if utility_type == "electricity" else 360
    severity_multiplier = 1 + max(average_severity - 2.5, 0) * 0.12
    density_bonus = 1.08 if report_count >= 4 else 1.0
    return int(round(report_count * base_multiplier * severity_multiplier * density_bonus))


def cluster_radius_from_count(report_count: int) -> int:
    if report_count <= 1:
        return 180
    return int(np.clip(140 + report_count * 90, 200, 1200))


def distance_between(point_a: tuple[float, float], point_b: tuple[float, float]) -> float:
    lat1, lon1 = map(radians, point_a)
    lat2, lon2 = map(radians, point_b)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    hav = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * asin(sqrt(hav))
