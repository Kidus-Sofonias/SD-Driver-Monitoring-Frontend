# Safe Driving Mobile App

Expo + React Native mobile frontend for the Safe Driving backend.

## What is included

- Email/password auth
- Driver dashboard
- Trip control flow: start, upload sample bursts, end, finalize
- Results and trip history
- Review dashboard and trip review details
- Configurable backend URL
- Mock sensor burst generator that matches the backend sample payload shape

## Backend URL

The app resolves backend URL in this order:

1. `EXPO_PUBLIC_API_BASE_URL` from `.env` (recommended)
2. Expo dev host LAN IP (auto-derived when possible)
3. Android emulator fallback `http://10.0.2.2:8000/api/v1`
4. Last fallback `http://127.0.0.1:8000/api/v1`

For stable behavior on a real phone with Expo Go, set `.env` explicitly:

`EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:8000/api/v1`

## Google Maps on Web

Historical trip routes now support real Google Maps tiles on web, but only when a Google Maps API key is configured.

Add this to `mobile-app/.env`:

`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key`

Notes:

- Web uses the Google Static Maps API to draw the saved trip path over real map tiles.
- Native mobile uses `react-native-maps`.
- If the key is missing, the app falls back to the lightweight route sketch preview instead of failing.
- After adding the key, restart the Expo dev server so the new env var is picked up.

## Run

```powershell
cd mobile-app
npm install
npm run android
```

Or start the Expo dev server:

```powershell
npm start
```

## Build for Android and iOS

This project is configured for Expo EAS builds.

Before building, replace the placeholder backend URL in `eas.json` with your deployed backend:

`https://YOUR-BACKEND.onrender.com/api/v1`

Install the EAS CLI and log in:

```powershell
npm install -g eas-cli
eas login
```

Create an Android APK for testing:

```powershell
npm run build:android:apk
```

Create an Android AAB for Play Store submission:

```powershell
npm run build:android:aab
```

Create an iOS build:

```powershell
npm run build:ios
```

Notes:

- Android APK is best for direct tester installs.
- Android AAB is best for Google Play.
- iOS device/TestFlight builds require an Apple Developer account.
- Expo will prompt you through signing credentials the first time.

If Expo Go on Android shows `failed to download ... java.io.IOException`, use:

```powershell
npm run start:tunnel:clear
```

This avoids local LAN transport issues that often block bundle downloads.

If you do not have admin access and LAN is unreliable, use USB localhost mode:

```powershell
npm run start:usb
```

## USB mode (most reliable on Android)

If LAN/tunnel is unstable, use USB with `adb reverse`.

1. Use PowerShell or Command Prompt (CMD).
2. Enable Developer Options + USB debugging on the phone.
3. Connect phone with USB and accept the debugging prompt.
4. Set the app backend URL in `.env`:

`EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1`

5. In PowerShell, run:

```powershell
cd "D:\AI and Python\Safe-driving\mobile-app"
npm run usb:reverse
```

If PowerShell blocks `npm` scripts on your machine, use `npm.cmd` instead:

```powershell
npm.cmd run usb:reverse
```

Or run manually in PowerShell:

```powershell
$env:ADB = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $env:ADB devices
& $env:ADB reverse tcp:8081 tcp:8081
& $env:ADB reverse tcp:19000 tcp:19000
& $env:ADB reverse tcp:19001 tcp:19001
& $env:ADB reverse tcp:8000 tcp:8000
& $env:ADB reverse --list
```

6. In CMD, set `adb` path for the current session:

```bat
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
"%ADB%" devices
```

7. Add reverse mappings:

```bat
"%ADB%" reverse tcp:8081 tcp:8081
"%ADB%" reverse tcp:19000 tcp:19000
"%ADB%" reverse tcp:19001 tcp:19001
"%ADB%" reverse tcp:8000 tcp:8000
"%ADB%" reverse --list
```

8. Start backend in another CMD window:

```bat
cd /d "D:\AI and Python\Safe-driving\backend"
conda run -n safe-driving-backend uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

9. Start Expo in localhost mode in another CMD window:

```bat
cd /d "D:\AI and Python\Safe-driving\mobile-app"
npm run start:localhost:clear
```

Shortcut:

```bat
cd /d "D:\AI and Python\Safe-driving\mobile-app"
npm run start:usb
```

10. Open Expo Go using:

`exp://127.0.0.1:8081`

If `adb` is not found, locate it with:

```bat
where /R "%LOCALAPPDATA%\Android\Sdk" adb.exe
```

## Notes

- This first version uses a mock sensor burst uploader so the frontend works immediately against the backend.
- The next step for production is replacing the mock burst generator with live GPS / accelerometer / gyroscope collection using Expo sensor and location packages.
- API requests now timeout after a short period so startup does not hang indefinitely when backend is unreachable.
- For physical devices, prefer tunnel mode if LAN mode keeps failing to download the JavaScript bundle.



set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
taskkill /F /IM adb.exe
"%ADB%" start-server
"%ADB%" devices

set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
"%ADB%" devices
"%ADB%" reverse tcp:8081 tcp:8081
"%ADB%" reverse tcp:19000 tcp:19000
"%ADB%" reverse tcp:19001 tcp:19001
"%ADB%" reverse tcp:8000 tcp:8000
"%ADB%" reverse --list

cd /d "D:\AI and Python\Safe-driving\backend"
conda activate safe-driving-backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

cd /d "D:\AI and Python\Safe-driving\mobile-app"
npm.cmd exec expo start -- --localhost --clear
