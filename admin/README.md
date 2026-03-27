# UFixr Admin Dashboard

This is the web dashboard for viewing outage clusters, maps, and updating cluster status.

## Requirements

- Node.js 20+
- backend running on `http://127.0.0.1:8000`

## Run locally

```powershell
cd admin
npm install
npm run dev
```

Open the local Vite URL shown in the terminal, usually:

- `http://127.0.0.1:5173`

## Important

- this frontend currently uses the backend URL hardcoded in `src/App.tsx`
- keep the backend running before starting the admin dashboard
- the map depends on cluster coordinates returned by the backend
