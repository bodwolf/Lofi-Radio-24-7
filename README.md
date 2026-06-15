# Renner Radio

Renner Radio is a static cyberpunk lo-fi radio dashboard with YouTube playback, realtime chat, temporary community channels, and private Studio Panel controls.

The app stays frontend-only: no framework, no backend server, and no committed private Firebase values.

## Features

- Main station grid with category dividers.
- YouTube-powered radio playback.
- Theme, background, visual effect, tuning glitch, static sound, and comfort controls.
- Anonymous Firebase chat with custom English display names.
- Temporary community radio channels with nested tracks.
- Private Renner Studio Panel for managing `/adminStations`.

## Local Run

```txt
npm run start
```

Then open:

```txt
http://127.0.0.1:4173/
```

Run checks:

```txt
npm run check
```

## Firebase

Keep real Firebase values out of git. Copy `firebase-config.example.js` to `firebase-config.js` locally, then paste the Firebase Web App config.

Firebase paths remain unchanged:

- `/adminStations`
- `/temporaryStations`
- `/chatMessages`
- `/userProfiles`
- `/siteSettings`

See `README_FIREBASE_SETUP.md` and `README_DEPLOYMENT.md` for full setup and deployment notes.
