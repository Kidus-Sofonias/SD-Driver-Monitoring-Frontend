# USB ADB Reverse Setup (Expo + Backend)

Use this when running the app on a physical Android phone over USB.

## Why this is needed

`adb reverse` maps phone ports back to your PC so Expo and backend requests work through USB.

## Prerequisites

1. Enable **Developer Options** and **USB debugging** on your phone.
2. Connect phone with USB and accept the debugging prompt.
3. Run commands in **PowerShell or Command Prompt (CMD)**.

## PowerShell quick setup (recommended on Windows)

From `mobile-app`:

```powershell
npm run usb:reverse
```

If PowerShell blocks `npm`, run:

```powershell
npm.cmd run usb:reverse
```

Manual PowerShell equivalent:

```powershell
$env:ADB = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $env:ADB devices
& $env:ADB reverse tcp:8081 tcp:8081
& $env:ADB reverse tcp:19000 tcp:19000
& $env:ADB reverse tcp:19001 tcp:19001
& $env:ADB reverse tcp:8000 tcp:8000
& $env:ADB reverse --list
```

## Set adb for current CMD session

```bat
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
"%ADB%" devices
```

You should see your device listed.

## Add reverse port mappings

```bat
"%ADB%" reverse tcp:8081 tcp:8081
"%ADB%" reverse tcp:19000 tcp:19000
"%ADB%" reverse tcp:19001 tcp:19001
"%ADB%" reverse tcp:8000 tcp:8000
"%ADB%" reverse --list
```

## What each port does

- `8081`: Metro bundler (JavaScript bundle)
- `19000`: Expo dev protocol
- `19001`: Expo dev tools channel
- `8000`: Safe Driving backend API

## Backend and app URL

Set this in `mobile-app/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

## Start services

1. Start backend:

```bat
cd /d "D:\AI and Python\Safe-driving\backend"
conda run -n safe-driving-backend uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

2. Start Expo (localhost mode):

```bat
cd /d "D:\AI and Python\Safe-driving\mobile-app"
npm run start:localhost:clear
```

3. Open Expo Go with:

```text
exp://127.0.0.1:8081
```

## Troubleshooting

- If no device appears in `"%ADB%" devices`, reconnect USB and re-allow debugging.
- If `adb` path fails, locate it:

```bat
where /R "%LOCALAPPDATA%\Android\Sdk" adb.exe
```

- Re-run reverse mapping after reconnecting the phone.
