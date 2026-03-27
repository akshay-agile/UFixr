# UFixr Backend

This is the FastAPI backend for UFixr. It provides:

- phone/password auth
- report creation
- image upload
- clustering and priority scoring
- SQLite persistence
- admin cluster APIs
- in-app alert generation

## Requirements

- Python 3.11+

## Run locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## URLs

- health check: `http://127.0.0.1:8000/health`
- API base: `http://127.0.0.1:8000`

## Notes

- the SQLite database is created automatically
- local uploaded images are stored in `app/uploads`
- for phone testing, the mobile app should point to your laptop's LAN IP, not `127.0.0.1`
