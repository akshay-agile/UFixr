from __future__ import annotations

import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "ufixr.db"

TECHNICIAN_SEED = [
    ("Priya Nair", "+91 98765 11001", 4.9, "electricity", "West Zone"),
    ("Arjun Rao", "+91 98765 11002", 4.7, "electricity", "Central Zone"),
    ("Kiran Das", "+91 98765 11003", 4.8, "water", "South Zone"),
    ("Asha Patel", "+91 98765 11004", 4.6, "water", "East Zone"),
    ("Rohit Menon", "+91 98765 11005", 4.5, "general", "Floating Crew"),
]


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON;")
    return connection


def ensure_column(connection: sqlite3.Connection, table: str, column_name: str, definition: str) -> None:
    columns = {row["name"] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}
    if column_name not in columns:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {definition}")


def init_db() -> None:
    connection = get_connection()
    cursor = connection.cursor()
    cursor.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS technicians (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            rating REAL NOT NULL,
            specialization TEXT NOT NULL,
            zone TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS clusters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            utility_type TEXT NOT NULL,
            status TEXT NOT NULL,
            center_latitude REAL NOT NULL,
            center_longitude REAL NOT NULL,
            report_count INTEGER NOT NULL,
            estimated_people INTEGER NOT NULL,
            priority_score REAL NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            cluster_id INTEGER,
            utility_type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            severity INTEGER NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            photo_url TEXT,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(cluster_id) REFERENCES clusters(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            report_id INTEGER,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS report_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id INTEGER NOT NULL,
            cluster_id INTEGER,
            status TEXT NOT NULL,
            title TEXT NOT NULL,
            detail TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE,
            FOREIGN KEY(cluster_id) REFERENCES clusters(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS technician_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id INTEGER NOT NULL UNIQUE,
            technician_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            rating INTEGER NOT NULL,
            comment TEXT,
            tags TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE,
            FOREIGN KEY(technician_id) REFERENCES technicians(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """
    )

    ensure_column(connection, "clusters", "technician_id", "technician_id INTEGER REFERENCES technicians(id) ON DELETE SET NULL")
    ensure_column(connection, "clusters", "technician_eta_minutes", "technician_eta_minutes INTEGER")
    ensure_column(connection, "clusters", "estimated_resolution_minutes", "estimated_resolution_minutes INTEGER")
    ensure_column(connection, "clusters", "assignment_note", "assignment_note TEXT")
    ensure_column(connection, "reports", "preferred_technician_id", "preferred_technician_id INTEGER REFERENCES technicians(id) ON DELETE SET NULL")
    ensure_column(connection, "reports", "issue_type", "issue_type TEXT")
    ensure_column(connection, "reports", "impact_level", "impact_level TEXT")
    ensure_column(connection, "reports", "video_url", "video_url TEXT")
    ensure_column(connection, "reports", "availability_status", "availability_status TEXT DEFAULT 'unknown'")
    ensure_column(connection, "reports", "availability_note", "availability_note TEXT")
    ensure_column(connection, "reports", "availability_windows", "availability_windows TEXT")
    ensure_column(connection, "reports", "completion_code", "completion_code TEXT")
    ensure_column(connection, "reports", "resolved_at", "resolved_at TEXT")
    ensure_column(connection, "reports", "completion_confirmed_at", "completion_confirmed_at TEXT")

    technician_count = connection.execute("SELECT COUNT(*) AS count FROM technicians").fetchone()["count"]
    if technician_count == 0:
        connection.executemany(
            """
            INSERT INTO technicians (name, phone, rating, specialization, zone, active)
            VALUES (?, ?, ?, ?, ?, 1)
            """,
            TECHNICIAN_SEED,
        )

    connection.commit()
    connection.close()
