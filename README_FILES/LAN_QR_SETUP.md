# LAN QR Setup for Multiple Phones (Expo Go)

Use this when you want other phones to scan the Expo QR code and use the app without USB.

## Goal

Make your laptop host both:
- Expo dev server (QR bundle)
- Backend API

Then any phone on the same Wi-Fi can open the app via Expo Go.

## 1. Connect to the same Wi-Fi

- Laptop and all phones must be on the same network.
- Avoid guest Wi-Fi if it blocks device-to-device traffic.

## 2. Set backend URL to your laptop LAN IP

In `mobile-app/.env` set:

```env
EXPO_PUBLIC_API_BASE_URL=http://<YOUR_LAPTOP_LAN_IP>:8000/api/v1
```

Example:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:8000/api/v1
```

## 3. Start backend on all interfaces

From `backend`:

```bat
conda run -n safe-driving-backend uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

`--host 0.0.0.0` allows phones on the network to reach your backend.

## 4. Start Expo in LAN mode

From `mobile-app`:

```bat
npm start
```

Expo will show a QR code.

## 5. On each phone

1. Install/open **Expo Go**.
2. Scan the QR code.
3. App should load and connect to backend via your laptop IP.

## Quick checks if it fails

- Confirm `.env` has your current laptop IP (IP may change on different networks).
- Confirm backend is running on port `8000`.
- Allow Windows Firewall access for port `8000` (and Expo if prompted).
- If QR opens but bundle fails to download, run:

```bat
npm run start:tunnel:clear
```

Note: Tunnel helps Expo bundle delivery, but backend URL still must point to a reachable host.

## Important difference from USB mode

- USB mode uses `adb reverse` + `127.0.0.1`, which works only for the connected phone.
- LAN mode uses your laptop LAN IP so multiple phones can connect.
