# UFixr Backend

FastAPI backend for authentication, report intake, clustering, admin operations, and notifications.

## Requirements

- Python 3.11+

## Install and Run

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Runtime URLs

- Health check: http://127.0.0.1:8000/health
- API base: http://127.0.0.1:8000
- Static uploads mount: /uploads

## Data and Storage

- SQLite DB is created automatically by startup initialization
- Uploaded images are stored in app/uploads

## Current API Surface

Public routes:

- GET /health
- POST /auth/register
- POST /auth/login
- POST /upload
- GET /technicians/options
- GET /reports/suggestions
- GET /admin/technicians
- GET /admin/clusters
- POST /admin/clusters/{cluster_id}/assign
- PATCH /admin/clusters/{cluster_id}/status

Protected routes (Authorization: Bearer <token>):

- GET /me
- POST /reports
- GET /reports/me
- GET /reports/nearby
- GET /notifications

## Core Capabilities

- Phone/password auth with session token flow
- Report creation with utility type, issue type, impact level, and optional photos
- Cluster analysis, priority scoring, and report-to-cluster assignment
- Admin status updates and technician assignment per cluster
- Notification generation for user-facing activity

## Dependencies

From requirements.txt:

- fastapi
- uvicorn[standard]
- python-multipart
- scikit-learn
- pydantic
- email-validator
