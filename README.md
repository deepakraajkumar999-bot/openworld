# OPEN WORLD. - Real Random Video Chat

## What is this?
Real Monkey / Omegle-style 1-on-1 random video chat.
Video is peer-to-peer with WebRTC. Server only matches people.

## Run locally (2 phones / 2 tabs)
1. Server:
```
cd server
npm install
npm start
# server on http://localhost:3001
```
2. Client:
Open `client/index.html` in browser - or serve it:
```
cd client
npx serve .
```
Change `SERVER_URL` in client/index.html to your server URL.

Allow Camera + Mic when asked. Use HTTPS or localhost (camera needs secure context).

## Test with 2 people
- Open client in 2 tabs / 2 phones
- Fill name, pick language + interests
- Tap START - you will match each other
- Tap NEXT - you re-match
- Chat works, Report works

## Deploy for real users
- Server -> Railway / Render (set PORT, deploy server folder)
- Client -> Vercel / Netlify (deploy client folder, set SERVER_URL to Railway URL)
- TURN server for users behind strict WiFi: use Twilio TURN or metered.ca
  Add TURN credentials in client/index.html RTC config.

## Safety (must have before Play Store)
- 18+ checkbox + phone verification (Firebase Auth)
- Report -> auto NEXT + review, 3 reports = temp ban
- AI moderation on snapshots (Google Vision / Hive)
- Never share phone numbers - chat filter already hides them

## Files
- server/server.js - matching + signaling
- server/package.json
- client/index.html - full app UI + WebRTC
