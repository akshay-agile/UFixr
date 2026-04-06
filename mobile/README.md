# UFixr Mobile App

Expo React Native app for citizen-side outage reporting and status tracking.

## Requirements

- Node.js 20+
- Expo Go (optional for physical device testing)

## Install and Start

```powershell
cd mobile
npm install
npm start
```

## Current Start Behavior

The start flow is managed by scripts/start-expo.cjs.

- Frees Metro port 8081 before launch
- Selects a host IP automatically (or uses EXPO_HOST_IP)
- Sets REACT_NATIVE_PACKAGER_HOSTNAME automatically when host IP is found
- Sets EXPO_PUBLIC_API_BASE_URL to http://<detected-ip>:8000 when not explicitly provided
- In auto mode, tries tunnel first and falls back to LAN if tunnel fails

## Available Scripts

- npm start
- npm run start:lan
- npm run start:tunnel
- npm run start:reset
- npm run android
- npm run ios
- npm run web

## Optional Environment Overrides (Windows PowerShell)

```powershell
$env:EXPO_HOST_IP="192.168.x.x"
$env:EXPO_PUBLIC_API_BASE_URL="https://your-public-api.example.com"
npm start
```

## API Integration

- API base URL is resolved in src/api/config.ts
- Most app calls use Authorization: Bearer <token> after login/register
- Routes used include /auth/login, /auth/register, /reports, /reports/me, /reports/nearby, /reports/suggestions, /upload, and /notifications

## Main Dependencies

- expo, react-native, react
- @react-navigation/native, @react-navigation/native-stack, @react-navigation/bottom-tabs
- expo-location, expo-image-picker, expo-camera
- react-native-maps
