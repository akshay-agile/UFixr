# UFixr - Utility Fault Reporting Platform

UFixr is a full-stack outage reporting system for electricity and water issues.
Citizens submit reports from the mobile app, and utility operators manage clustered incidents in the admin dashboard.

## Current Stack

- Backend: FastAPI + SQLite
- Mobile: Expo + React Native (TypeScript)
- Admin: React + Vite + Leaflet

## Repository Layout

```
.
├── backend/   # FastAPI API + clustering logic + SQLite persistence
├── mobile/    # Expo React Native citizen app
└── admin/     # React dashboard for cluster monitoring and actions
```

## Prerequisites

- Python 3.11+
- Node.js 20+
- npm
- Expo Go (optional, for device testing)

## Quick Start

### 1. Start Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend URLs:

- Health: http://127.0.0.1:8000/health
- API base: http://127.0.0.1:8000
- Uploaded files: http://127.0.0.1:8000/uploads/<filename>

### 2. Start Admin Dashboard

```powershell
cd admin
npm install
npm run dev
```

Default local URL: http://127.0.0.1:5173

### 3. Start Mobile App

```powershell
cd mobile
npm install
npm start
```

Important behavior of npm start in mobile:

- Automatically frees Metro port 8081
- Tries Expo tunnel first, then falls back to LAN
- Auto-detects machine IP and sets EXPO_PUBLIC_API_BASE_URL as http://<detected-ip>:8000 when not already set

## API Endpoints (Current)

All routes below are served directly from the API base (no /api prefix).

Public routes:

- GET /health
- POST /auth/register
- POST /auth/login
- POST /upload
- GET /technicians/options?utility_type=electricity|water
- GET /reports/suggestions?utility_type=...&latitude=...&longitude=...
- GET /admin/technicians
- GET /admin/clusters
- POST /admin/clusters/{cluster_id}/assign
- PATCH /admin/clusters/{cluster_id}/status

Routes requiring Authorization: Bearer <token>:

- GET /me
- POST /reports
- GET /reports/me
- GET /reports/nearby?latitude=...&longitude=...
- GET /notifications

## Key Features in Current Codebase

- Phone/password registration and login
- Report submission with utility type, issue type, impact level, optional photos
- Automatic clustering and priority scoring
- Admin incident map with filtering, status updates, and technician assignment
- In-app notification feed

## Troubleshooting

### PowerShell blocks venv activation

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Mobile app cannot reach backend from device

- Ensure backend is running on port 8000
- Ensure phone and laptop are on the same network for LAN mode
- Allow Python through Windows Firewall if needed
- Use npm run start:tunnel when cross-network connectivity is required

### Admin dashboard shows no clusters

- Verify backend is running
- Check http://127.0.0.1:8000/admin/clusters responds with data

## Project README Files

- Root overview: README.md
- Backend details: backend/README.md
- Admin details: admin/README.md
- Mobile details: mobile/README.md

## Docs Maintenance Checklist

When making feature or infra changes, update docs in the same PR:

- If backend routes or HTTP methods change, update endpoint lists in root and backend README.
- If startup/build scripts change, update run commands in root, admin, and mobile README.
- If auth flow or required headers change, update request examples and auth notes.
- If environment variables or runtime URLs change, update setup/config sections.
- If dependencies change, update dependency summaries where listed.
- If module behavior changes, update that module's README first, then align root README.
- Update the root README status date after documentation sync is complete.

## Status

Documentation synced with current codebase on April 6, 2026.
