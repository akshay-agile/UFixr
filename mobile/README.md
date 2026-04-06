# UFixr Mobile App

Install and run:

```bash
npm install
npm start
```

`npm start` is now fully automated:
- Kills stale Metro process on port `8081`.
- Tries Expo `tunnel` first (best for devices on different networks).
- Falls back to Expo `lan` automatically if tunnel is unavailable.
- Auto-detects your machine IP and injects `EXPO_PUBLIC_API_BASE_URL` as `http://<detected-ip>:8000` so you do not edit API IPs manually.

Optional modes:

```bash
npm run start:lan
npm run start:tunnel
npm run start:reset
```

Optional overrides:

```bash
set EXPO_HOST_IP=192.168.x.x
set EXPO_PUBLIC_API_BASE_URL=https://your-public-api.example.com
npm start
```
