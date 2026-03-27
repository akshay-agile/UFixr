# UtilityWatch

UtilityWatch is a beginner-friendly full-stack hackathon MVP with three parts:

- `backend/`: FastAPI + SQLite + DBSCAN clustering + priority scoring
- `mobile/`: Expo React Native citizen app
- `admin/`: React + Vite admin dashboard

## What is already built

- citizen sign up and login with phone + password
- GPS-based fault reporting for electricity or water
- optional photo upload
- live fault map in the mobile app
- DBSCAN outage clustering on the backend
- automatic priority scoring based on report count, severity, age, and utility type
- admin dashboard with map, ranked clusters, and status update buttons
- citizen notification feed when admin changes status

## Important demo note

This project includes the full app flow, but real push notifications through Firebase FCM are **not** wired yet. For the hackathon demo, status updates appear in the app's `Alerts` screen instead. That keeps the app easy to run locally for your first build.

## 1. Install tools first

You need these installed on your laptop:

1. Python 3.11 or newer
2. Node.js 20 or newer
3. Git
4. Expo Go app on your Android phone from Play Store

To check if Python and Node are installed, open PowerShell and run:

```powershell
python --version
node --version
npm --version
```

## 2. Open the project

In PowerShell:

```powershell
cd "d:\Akshay\Hackverse college hackathon"
```

## 3. Start the backend server

Open a new PowerShell window and run:

```powershell
cd "d:\Akshay\Hackverse college hackathon\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

What this does:

- creates a Python virtual environment
- installs backend packages
- starts the API at `http://127.0.0.1:8000`
- creates the SQLite database automatically on first run

To test the backend, open this in your browser:

- `http://127.0.0.1:8000/health`

You should see:

```json
{"status":"ok"}
```

## 4. Find your laptop's local IP address

The phone needs to talk to your laptop over Wi-Fi.

In another PowerShell window run:

```powershell
ipconfig
```

Look for your Wi-Fi adapter and find the `IPv4 Address`.
It will look something like `192.168.1.8`.

## 5. Update the mobile app backend URL

Open this file:

- `mobile/src/api/config.ts`

Change this line:

```ts
export const API_BASE_URL = "http://127.0.0.1:8000";
```

To something like:

```ts
export const API_BASE_URL = "http://192.168.1.8:8000";
```

Use your real IPv4 address, not the example one above.

## 6. Start the mobile app

Open a new PowerShell window and run:

```powershell
cd "d:\Akshay\Hackverse college hackathon\mobile"
npm install
npm start
```

Then:

1. Keep your laptop and phone on the same Wi-Fi
2. A QR code will appear in the terminal/browser
3. Open Expo Go on your phone
4. Scan the QR code
5. The app should open on your phone

If the app cannot connect to the backend:

- check that backend is still running
- check that `API_BASE_URL` uses your laptop's IPv4 address
- check that phone and laptop are on the same Wi-Fi
- allow Python through Windows Firewall if prompted

## 7. Start the admin dashboard

Open a new PowerShell window and run:

```powershell
cd "d:\Akshay\Hackverse college hackathon\admin"
npm install
npm run dev
```

Then open the local URL shown by Vite, usually:

- `http://127.0.0.1:5173`

## 8. Test the full flow

Use this order:

1. Register in the mobile app
2. Open `Report Fault`
3. Allow location permission
4. Submit 1 or more reports
5. Open `My Reports` to see your submissions
6. Open the admin dashboard in your browser
7. Click `Acknowledge` or `In Progress` on a cluster
8. Go back to the mobile app and open `Alerts`
9. You should see the status update there

## 9. How clustering works in this app

- reports with the same utility type are grouped using DBSCAN
- if at least 3 active reports are close together, they become one outage cluster
- smaller isolated reports still appear as their own cluster-like item for visibility
- electricity gets a higher score than water
- older and more frequently reported issues get higher priority

## 10. Hackathon demo script

Say this while showing the app:

1. "A resident sees no power and reports it in under 30 seconds."
2. "Our backend immediately clusters nearby complaints using DBSCAN."
3. "Instead of 8 complaints, the utility team sees 1 outage cluster."
4. "We score each cluster by urgency so the most critical issue rises to the top."
5. "When the admin updates the status, the citizen sees the change in real time in the alerts feed."

## 11. Folder guide

- `backend/app/main.py`: API routes
- `backend/app/ml.py`: DBSCAN clustering and priority score logic
- `backend/app/services.py`: reclustering and notification logic
- `mobile/App.tsx`: app navigation
- `mobile/src/screens/ReportFaultScreen.tsx`: report submission screen
- `admin/src/App.tsx`: admin dashboard

## 12. Common beginner problems

### `python` is not recognized
Install Python and make sure "Add Python to PATH" was checked during installation.

### PowerShell blocks virtual environment activation
Run this once in PowerShell as your normal user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Then try activating the venv again.

### Expo QR code opens but app keeps loading
Usually this means the backend URL is wrong or the phone cannot reach the laptop.

### Photo upload fails
Make sure the backend server is running and Windows Firewall allowed Python.

## 13. What to improve next after this MVP

- real JWT auth instead of demo sessions
- PostgreSQL instead of SQLite
- real Firebase FCM push notifications
- proper nearby filtering and heatmaps
- admin login and role-based access
- deployment to Render, Railway, or VPS
