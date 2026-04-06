# UFixr Admin Dashboard

React + Vite dashboard for monitoring outage clusters, viewing map intelligence, assigning technicians, and updating cluster status.

## Requirements

- Node.js 20+
- Backend API running at http://127.0.0.1:8000

## Install and Run

```powershell
cd admin
npm install
npm run dev
```

Vite dev URL is typically http://127.0.0.1:5173

## Build and Preview

```powershell
npm run build
npm run preview
```

## Current Integration Details

- Backend base URL is currently hardcoded in src/App.tsx as http://127.0.0.1:8000
- Dashboard auto-refreshes cluster data every 15 seconds
- Uploaded evidence images are normalized to the backend origin when rendering

## Backend Routes Used by Admin

- GET /admin/clusters
- PATCH /admin/clusters/{cluster_id}/status
- POST /admin/clusters/{cluster_id}/assign

## Main Dependencies

- react, react-dom
- leaflet, react-leaflet, leaflet.heat
- framer-motion
- recharts
