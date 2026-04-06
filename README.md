# UFixr - Utility Fault Reporting Platform

UFixr is a full-stack utility fault reporting system that connects citizens with utility teams to report and fix electricity and water outages in real-time.

## 🎯 Features

- **Mobile App**: Citizens can report electricity and water faults with photos and location
- **Admin Dashboard**: Utilities view clustered outages on a live map and update status
- **Smart Clustering**: Backend automatically groups nearby reports
- **Priority Scoring**: Automatic priority calculation for technician dispatch
- **Real-time Alerts**: Users are notified when report status changes
- **Authentication**: Secure phone + password login system
- **Image Uploads**: Optional photo documentation of faults

## 🏗️ Architecture

**Three-tier full-stack:**

| Component | Tech Stack | Purpose |
|-----------|------------|---------|
| **Backend** | FastAPI + SQLite | API, clustering, scoring, persistence |
| **Mobile** | Expo + React Native | Citizen reporting app |
| **Admin** | React + Vite | Dashboard for utility teams |

## 📋 Prerequisites

Install these before running:

- **Python 3.11+** (`python --version`)
- **Node.js 20+** (`node --version`, `npm --version`)
- **Git** (for cloning)
- **Expo Go** (optional, for testing mobile on-device)

Verify installations:

```powershell
python --version
node --version
npm --version
```

## 🚀 Quick Start

### 1. Clone the Repository

```powershell
git clone https://github.com/akshay-agile/UFixr.git
cd UFixr
```

### 2. Start Backend (FastAPI Server)

Open Terminal 1:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Backend Details:**

- Health check: `http://127.0.0.1:8000/health`
- API base: `http://127.0.0.1:8000`
- Database: Auto-created SQLite by backend startup
- Uploads: Images stored in `backend/app/uploads/`
- Expected health response: `{"status":"ok"}`

### 3. Start Admin Dashboard (React + Vite)

Open Terminal 2:

```powershell
cd admin
npm install
npm run dev
```

**Admin Details:**

- URL: `http://127.0.0.1:5173` (shown in terminal)
- Features: Live map, cluster management, status updates, technician assignment
- Backend dependency: Keep backend running while using dashboard
- Backend URL source: currently hardcoded in `admin/src/App.tsx`

### 4. Start Mobile App (Expo + React Native)

Open Terminal 3:

```powershell
cd mobile
npm install
npm start
```

**Mobile Setup (current behavior):**

- `npm start` is automated via `mobile/scripts/start-expo.cjs`
- Kills stale Metro process on port `8081`
- Tries Expo `tunnel` first, then falls back to Expo `lan` automatically
- Auto-detects host IP and sets `EXPO_PUBLIC_API_BASE_URL` to `http://<detected-ip>:8000` when not manually set

## 🔧 Configuration

### Mobile Backend URL

Manual edits to `mobile/src/api/config.ts` are usually **not required** now.

Optional overrides (PowerShell):

```powershell
$env:EXPO_HOST_IP="192.168.1.8"
$env:EXPO_PUBLIC_API_BASE_URL="http://192.168.1.8:8000"
npm start
```

### Admin Backend URL

Dashboard backend URL is currently configured in `admin/src/App.tsx` as:

`http://127.0.0.1:8000`

## 📁 Project Structure

```
UFixr/
├── backend/              # FastAPI server
│   ├── app/
│   │   ├── main.py       # Entry point and API routes
│   │   ├── auth.py       # Authentication/session helpers
│   │   ├── db.py         # Database setup
│   │   ├── ml.py         # Clustering and scoring logic
│   │   ├── schemas.py    # Request models
│   │   ├── services.py   # Business logic helpers
│   │   └── uploads/      # User images
│   └── requirements.txt  # Python dependencies
│
├── mobile/               # React Native app
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── context/
│   │   ├── api/
│   │   └── theme.ts
│   ├── scripts/
│   │   └── start-expo.cjs
│   ├── App.tsx
│   ├── package.json
│   └── app.json
│
├── admin/                # React web dashboard
│   ├── src/
│   │   ├── App.tsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

## 🎨 Design System

Both apps use a modern, accessibility-focused design language.

**Core palette:**

- Primary: Indigo (`#6366f1`)
- Electricity: Amber (`#f59e0b`)
- Water: Blue (`#3b82f6`)
- Success: Green (`#10b981`)
- Critical: Red (`#ef4444`)

**Typography and spacing:**

- Page titles: 28-32px, bold
- Section headers: 15-18px, semi-bold
- Body text: 13-14px
- Base spacing rhythm: 4px/8px increments depending on screen and component

## 🔐 Security Notes

- Phone/password authentication implemented
- SQLite is local for development simplicity
- Image uploads stored server-side
- API is CORS-enabled for local integration

For production:

- Deploy behind HTTPS
- Move secrets and runtime config to environment variables
- Use managed DB and backups
- Use cloud object storage for images

## 📱 Supported Devices

**Mobile:**

- Android and iOS via Expo/React Native
- Phone-first UI, works on tablets

**Web (Admin):**

- Latest Chrome, Firefox, Edge, Safari

## 🐛 Troubleshooting

### Backend Issues

- **Port 8000 already in use**: Change port or free the port
- **Module not found**: Activate venv and run `pip install -r requirements.txt`

### Mobile Issues

- **App cannot reach backend**: Ensure backend is running and reachable from your device
- **Expo connection issues**: Try `npm run start:tunnel` or `npm run start:lan`

### Admin Dashboard Issues

- **Map not loading**: Confirm backend is running and `/admin/clusters` returns data
- **Status/assign updates failing**: Check backend logs and network requests from dashboard

## 📊 API Endpoints

All routes are under API base `http://127.0.0.1:8000` (no `/api` prefix).

**Health & Authentication:**

- `GET /health` - Health check
- `POST /auth/register` - Register with phone + password
- `POST /auth/login` - Login
- `GET /me` - Get current authenticated user

**Reports & Notifications:**

- `POST /upload` - Upload report photo
- `POST /reports` - Create new report
- `GET /reports/me` - List current user's reports
- `GET /reports/nearby` - Nearby active clusters for map context
- `GET /reports/suggestions` - Suggest cluster/technician options
- `GET /notifications` - User notifications

**Admin Cluster Operations:**

- `GET /admin/technicians` - List technicians
- `GET /admin/clusters` - Get all clusters with analytics
- `POST /admin/clusters/{cluster_id}/assign` - Assign technician to cluster
- `PATCH /admin/clusters/{cluster_id}/status` - Update cluster/report status

## 📚 Project Documentation

- `README.md` - Project overview and quick start
- `backend/README.md` - Backend details
- `admin/README.md` - Admin dashboard details
- `mobile/README.md` - Mobile app details

## 📦 Key Dependencies

**Backend (`backend/requirements.txt`):**

- fastapi
- uvicorn[standard]
- python-multipart
- scikit-learn
- pydantic
- email-validator

**Mobile (`mobile/package.json`):**

- expo
- react-native
- @react-navigation/native
- @react-navigation/native-stack
- @react-navigation/bottom-tabs
- react-native-maps

**Admin (`admin/package.json`):**

- react
- react-leaflet
- leaflet
- leaflet.heat
- framer-motion
- recharts

## 🧭 Docs Maintenance Checklist

When making feature or infrastructure changes, update docs in the same PR:

- If backend routes or HTTP methods change, update endpoint lists in root and backend README.
- If startup/build scripts change, update run commands in root, admin, and mobile README.
- If auth flow or required headers change, update request examples and auth notes.
- If environment variables or runtime URLs change, update setup/config sections.
- If dependencies change, update dependency summaries where listed.
- If module behavior changes, update that module's README first, then align root README.
- Update the root README status date after documentation sync is complete.

## ✅ Status

Production-ready hackathon MVP.

**Last Updated:** April 7, 2026
