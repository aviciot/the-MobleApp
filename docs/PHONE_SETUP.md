# Phone Dev Setup — Samsung S24 Ultra

This replaces the Android emulator. You build once in the cloud, then hot-reload runs over USB.

---

## One-time setup

### 1. Enable USB Debugging on S24 Ultra

1. Settings → About phone → Software information
2. Tap **Build number** 7 times (you'll see "You are now a developer")
3. Back → Settings → Developer options
4. Enable **USB debugging**
5. Enable **Stay awake** (keeps screen on while charging/plugged in)

### 2. Install Android Platform Tools (just adb, no Android Studio)

Download from: https://developer.android.com/tools/releases/platform-tools
- Download the Windows zip
- Unzip to `C:\adb`
- Add to PATH: Search "Environment Variables" → System Variables → Path → Add `C:\adb`
- Open a new PowerShell and run: `adb version` — should print a version number

### 3. Install expo-dev-client and EAS CLI

Run in PowerShell from the project directory:
```
cd "C:\Users\acohen.SHIFT4CORP\Desktop\PythonProjects\theM\app\theM"
npx expo install expo-dev-client
npm install -g eas-cli
```

### 4. Create an Expo account and link project

```
eas login
eas init
```

`eas init` will fill in the `projectId` in app.json automatically.

### 5. Cloud build (runs on Expo's servers — no local Gradle needed)

```
eas build --platform android --profile development
```

- Takes 10-15 minutes first time (Expo's servers compile Skia, Reanimated etc.)
- When done, you get a QR code / download link for the APK
- Install the APK on your S24 Ultra (allow "Install unknown apps" when prompted)

---

## Every dev session (instant)

1. Plug S24 Ultra into PC via USB-C
2. On phone: tap "Allow USB debugging" when prompted (first time only)
3. Run in PowerShell:
```
adb reverse tcp:8081 tcp:8081
cd "C:\Users\acohen.SHIFT4CORP\Desktop\PythonProjects\theM\app\theM"
npx expo start --dev-client
```
4. Open the **theM** app on your phone
5. It connects to your Metro server automatically
6. Save any file → phone updates in ~1 second

---

## When do you need to rebuild (eas build again)?

Only when you:
- Add a new native package (npm install something with native code)
- Change app.json plugins
- Bump Expo SDK version

Regular JS/React changes never need a rebuild — they hot reload.

---

## Troubleshooting

**`adb devices` shows nothing:** Try a different USB cable (must be data cable, not charge-only). Also check Developer Options → USB debugging is on.

**Phone shows "Allow USB debugging?" prompt:** Tap Allow (check "Always allow from this computer").

**Metro can't connect:** Run `adb reverse tcp:8081 tcp:8081` again. This must be run after every USB reconnect.

**App crashes on launch:** Run `adb logcat | grep -i "them\|error\|fatal"` to see native logs.
