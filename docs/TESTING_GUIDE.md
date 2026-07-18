# Testing Guide — The-M Mobile App

## What you need installed

- **Node.js** (you have v24 ✓)
- **Expo Go app** on your phone — install from App Store (iOS) or Play Store (Android)
- Your phone and laptop on the **same WiFi network**

---

## Step 1 — Start the dev server

Open a terminal, run:

```
cd "C:\Users\acohen.SHIFT4CORP\Desktop\PythonProjects\theM\app\theM" 
npx expo start --clear
```

You'll see a QR code in the terminal.

---

## Step 2 — Open on your phone

Open **Expo Go** → tap **Scan QR Code** → scan the QR from the terminal.

The app will bundle and launch on your phone (first load takes ~30 seconds, after that it's instant on reload).

---

## What you should see

### Screen 1 — Splash (auto, ~2.4 seconds)
- Black screen
- Glowing purple orb ignites from the center
- Particles spawn around the rim
- **"THE·M"** and **"Intelligence. Spoken."** fade in below
- Automatically moves to Login

### Screen 2 — Login
- Same dark background, orb breathing slowly (dormant/dim purple)
- Background particles drifting gently
- **"Speak. It listens."** tagline
- Two buttons: **"Continue with Face ID"** (glowing pill) and **"Continue with Google"** (ghost)
- Tap **Face ID** → orb wakes up (brighter, particles flare) → navigates to Home
- Tap **Google** → shows a placeholder alert (not wired yet)

### Screen 3 — Home (demo auto-plays)
The demo runs automatically once you land on Home. Watch the sequence:

| Time | What happens |
|---|---|
| 0.8s | Orb turns **cyan/blue** — user speaking |
| 2.2s | Orb turns **purple** — AI thinking |
| 3.4s | Orb turns **magenta** — AI speaking, transcript streams at the bottom |
| 4.2s | First card appears: **"WebRTC Connected"** status card |
| 5.5s | **Chart card** floats out: "+24% Revenue vs Plan" |
| 7.0s | **Text card** floats out: "Q2 Performance" summary |
| 9.0s | **File card** floats out: "Board_Brief.pdf" |
| 11s | Orb goes cyan again — next user question |
| 15.5s | **Image card** floats out (placeholder, no image yet) |
| 17s | Orb returns to idle |

---

## Interactions to test

| Action | Expected |
|---|---|
| **Swipe a card** | Card flies off screen and disappears |
| **Tap a card** | No action yet — coming in next milestone |
| **Tap the mic icon** in transcript bar | Toggles mute, icon changes 🎤 → 🔇 |
| **Tap the transcript text** | No action yet — history sheet coming later |

---

## If something goes wrong

**App won't load / bundling error:**
```
cd "C:\Users\acohen.SHIFT4CORP\Desktop\PythonProjects\theM\app\theM"
npx expo start --clear
```
The `--clear` wipes the Metro cache which fixes most issues.

**"Unable to connect" on phone:** Make sure phone and laptop are on the same WiFi. If on corporate WiFi with device isolation, try:
```
npx expo start --tunnel
```

**Blank white screen:** Shake your phone → tap **"Reload"** in the menu that appears.

---

## What is NOT working yet (by design)

- Face ID / Google login → fake, just navigates after 0.9s delay
- WebRTC → no real voice connection
- Microphone → not capturing real audio (orb animation is simulated)
- Card tap → no action
- Image card → no real image (placeholder box)

All of these are Milestone 2 and 3 work. The demo proves the UI, animations, and architecture are solid before wiring the real backend.
