# UFixr

UFixr is a full-stack utility fault reporting project with three parts:

- `backend/`: FastAPI + SQLite backend with clustering and priority scoring
- `mobile/`: Expo React Native citizen app
- `admin/`: React + Vite admin dashboard

## What it does

- user sign up and login with phone + password
- electricity and water fault reporting
- optional photo upload
- location-based reporting
- outage clustering on the backend
- priority scoring for utility teams
- admin dashboard with map and cluster status updates
- in-app alerts when report status changes

## Project structure

- [backend/README.md](/d:/Akshay/Hackverse%20college%20hackathon/backend/README.md)
- [mobile/App.tsx](/d:/Akshay/Hackverse%20college%20hackathon/mobile/App.tsx)
- [admin/README.md](/d:/Akshay/Hackverse%20college%20hackathon/admin/README.md)

## Prerequisites

Install these first:

- Python 3.11+
- Node.js 20+
- Git
- Expo Go on an Android phone if you want to test the mobile app on-device

Check your versions:

```powershell
python --version
node --version
npm --version
```

## 1. Clone the repo

```powershell
git clone https://github.com/akshay-agile/UFixr.git
cd UFixr
```

## 2. Start the backend

Open a terminal:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at:

- `http://127.0.0.1:8000`
- `http://127.0.0.1:8000/health`

Expected health response:

```json
{"status":"ok"}
```

Notes:

- the SQLite database is created automatically on first run
- uploaded report images are stored in `backend/app/uploads`

## 3. Start the admin dashboard

Open another terminal:

```powershell
cd admin
npm install
npm run dev
```

Then open the local Vite URL, usually:

- `http://127.0.0.1:5173`

Important:

- the admin app currently expects the backend at `http://127.0.0.1:8000`
- keep the backend running while using the admin dashboard

## 4. Start the mobile app

The mobile app must talk to your laptop over Wi-Fi, so you need your laptop's local IP address.

Find it with:

```powershell
ipconfig
```

Look for your Wi-Fi adapter's `IPv4 Address`, for example `192.168.1.8`.

Then update [mobile/src/api/config.ts](/d:/Akshay/Hackverse%20college%20hackathon/mobile/src/api/config.ts):

```ts
export const API_BASE_URL = "http://YOUR_LAPTOP_IP:8000";
```

Example:

```ts
export const API_BASE_URL = "http://192.168.1.8:8000";
```

Then start Expo:

```powershell
cd mobile
npm install
npx expo start --host lan --clear
```

Then:

1. Keep your phone and laptop on the same Wi-Fi.
2. Open Expo Go on your phone.
3. Scan the QR code or manually enter the `exp://...` URL shown by Expo.

## 5. Full demo flow

1. Start the backend.
2. Start the admin dashboard.
3. Start the mobile app.
4. Register a user in the app.
5. Submit one or more water or electricity reports.
6. Open the admin dashboard and update a cluster status.
7. Go back to the app and check `Alerts`.

## Common setup issues

### PowerShell blocks venv activation

Run once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Mobile app cannot reach backend

Check all of these:

- backend is running on port `8000`
- `mobile/src/api/config.ts` uses your laptop's real Wi-Fi IP
- phone and laptop are on the same Wi-Fi
- Windows Firewall allowed Python

### Expo opens but app bundle does not load

Try:

```powershell
cd mobile
npx expo start --host lan --clear
```

If Expo shows `127.0.0.1` instead of your LAN IP, set the packager hostname explicitly:

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME="YOUR_LAPTOP_IP"
npx expo start --host lan --clear
```

### Admin dashboard map is blank

Check:

- the backend is running
- `/admin/clusters` returns data
- cluster coordinates are present in backend responses

### Photo upload fails

Check:

- backend is running
- phone can reach the backend IP
- Windows Firewall is not blocking Python

## Notes for reviewers

- this project is meant as a hackathon MVP
- notifications are shown inside the app and are not Firebase push notifications yet
- SQLite is used for local simplicity

## Future improvements

- move config to env files instead of editing source files
- real JWT auth
- PostgreSQL instead of SQLite
- cloud image storage
- Firebase push notifications
- admin authentication and roles
- deployment for backend, admin, and mobile builds
