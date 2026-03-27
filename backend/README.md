# UtilityWatch Backend

This is the FastAPI backend for UtilityWatch. It provides:

- demo authentication with phone + password
- report creation and image upload
- DBSCAN-based outage clustering
- priority scoring for admin ranking
- SQLite persistence

Run it with:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```
