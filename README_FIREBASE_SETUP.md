# Renner Radio Firebase Setup

V9 prepares Firebase only. It does not send chat messages, save playlist links, or read live data yet.

## 1. Create the Firebase project

1. Open the Firebase console.
2. Create a project for Renner Radio.
3. Add a Web App from the project overview.
4. Enable Realtime Database.
5. Enable Authentication, then enable the Anonymous sign-in provider.

## 2. Add local config

Copy the example file:

```txt
firebase-config.example.js -> firebase-config.js
```

Paste the Firebase Web App config into `firebase-config.js`.

Do not commit `firebase-config.js`; it is ignored by git.

## 3. Deploy database rules

Use one of these options:

- Firebase console: Realtime Database -> Rules -> paste `database.rules.json`.
- Firebase CLI: point your Firebase project at `database.rules.json`, then deploy database rules.

The rules prepare:

- `playlistItems` for V10 YouTube playlist entries.
- `chatMessages` for V11 anonymous chat messages.
- `userProfiles` for V11 anonymous display names and colors.

## 4. Run locally

Use the current static setup:

```txt
python -m http.server 4173
```

Then open:

```txt
http://127.0.0.1:4173/
```

Expected console behavior:

- Without `firebase-config.js`: the app keeps running in static preview mode.
- With valid config and Anonymous Auth enabled: the console shows `Firebase ready.`

## Fix STATIC MODE

If the app still shows `Static mode`, check these first:

1. `firebase-config.js` must be in the same folder as `index.html`.
2. `firebase-config.js` must export `firebaseConfig`:

```js
export const firebaseConfig = {
  apiKey: "PASTE_FIREBASE_API_KEY_HERE",
  authDomain: "bodwolf-radio.firebaseapp.com",
  databaseURL: "https://bodwolf-radio-default-rtdb.firebaseio.com/",
  projectId: "bodwolf-radio",
  storageBucket: "bodwolf-radio.firebasestorage.app",
  messagingSenderId: "PASTE_MESSAGING_SENDER_ID_HERE",
  appId: "PASTE_APP_ID_HERE"
};
```

3. Replace every `PASTE_..._HERE` value with the real Firebase Web App value.
4. Keep `databaseURL` in the config.
5. Do not add `initializeApp`, `getAnalytics`, or service account keys to `firebase-config.js`.
6. Enable Anonymous Authentication in Firebase Console.
7. Enable Realtime Database.
8. Publish `database.rules.json` to Realtime Database Rules.
9. Restart the local server after creating or editing `firebase-config.js`.
10. Open `http://127.0.0.1:4173/`; avoid `file://` for Firebase testing.

Useful console messages:

- `Firebase config missing. Static mode enabled.`
- `Firebase initialized.`
- `Anonymous auth ready.`
- `Firebase smoke test passed.`
- `Firebase error: ...`

## V9.1 Smoke Test

1. Keep `firebase-config.js` local and ignored by git.
2. Add real Firebase Web App values to `firebase-config.js`.
3. Enable Anonymous Authentication.
4. Enable Realtime Database.
5. Open `http://127.0.0.1:4173/`.
6. Check the console for `Firebase ready.` and `Firebase smoke test passed.`
7. Confirm the radio still works: station selection, random station, volume, theme, background, and visual effects.

The smoke test does not write data. It only checks that Firebase initialized, anonymous auth is active, and a Realtime Database reference can be created.

## V10.1 Playlist Test

Sample links supported by `extractYouTubeVideoId(url)`:

- `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `https://youtu.be/dQw4w9WgXcQ`
- `https://www.youtube.com/embed/dQw4w9WgXcQ`
- `https://www.youtube.com/shorts/dQw4w9WgXcQ`

Local preview test:

1. Temporarily leave `firebase-config.js` missing.
2. Open `http://127.0.0.1:4173/`.
3. Confirm the playlist panel says `Local preview only. Firebase not connected.`
4. Add a valid sample link, including by pressing Enter in the input.
5. Confirm invalid links are rejected.
6. Confirm duplicate video IDs are rejected.
7. Play the item and confirm the main YouTube player loads it.
8. Remove the item and confirm it disappears from the local list.

Live Firebase test:

1. Add real local values to ignored `firebase-config.js`.
2. Enable Anonymous Authentication and Realtime Database.
3. Deploy `database.rules.json`.
4. Open `http://127.0.0.1:4173/`.
5. Confirm the playlist panel shows Firebase sync.
6. Add a valid link and check `/playlistItems` in Realtime Database.
7. Remove the item and confirm its `status` changes to `removed`; it should not be hard deleted.
8. Confirm only active items are visible in the app.

## V11 Chat Test

Local preview test:

1. Temporarily leave `firebase-config.js` missing.
2. Open `http://127.0.0.1:4173/`.
3. Open the chat panel.
4. Confirm the panel says `Local preview only. Firebase not connected.`
5. Send a normal message and confirm it appears in the message list.
6. Confirm empty messages are rejected.
7. Confirm messages over 160 characters are rejected.
8. Send two messages quickly and confirm the 2 second rate limit appears.
9. Reload the page and confirm the anonymous name is reused from localStorage.

Live Firebase test:

1. Add real local values to ignored `firebase-config.js`.
2. Enable Anonymous Authentication and Realtime Database.
3. Deploy `database.rules.json`.
4. Open `http://127.0.0.1:4173/` in two browser tabs.
5. Confirm both chat panels show Firebase sync.
6. Send a message from tab one and confirm it appears in tab two.
7. Check `/chatMessages` and `/userProfiles` in Realtime Database.
8. Confirm messages include `text`, `displayName`, `userColor`, `uid`, and `createdAt`.

## Final Firebase Live Test

Use this before starting V12 deployment:

1. Keep `firebase-config.js` local and ignored by git.
2. Add real Firebase Web App values to `firebase-config.js`.
3. Enable Anonymous Authentication.
4. Enable Realtime Database.
5. Deploy `database.rules.json`.
6. Open `http://127.0.0.1:4173/` in two browser tabs.
7. Confirm the console shows `Firebase ready.`
8. Confirm the console shows `Firebase smoke test passed.`
9. Add a playlist item in tab one.
10. Confirm the playlist item appears in tab two.
11. Remove the playlist item in tab one.
12. Confirm it disappears from both tabs.
13. Send a chat message in tab one.
14. Confirm the chat message appears in tab two.
15. Check Realtime Database paths:
    - `/playlistItems`
    - `/chatMessages`
    - `/userProfiles`

## Pre-deployment Checklist

- `firebase-config.js` is ignored and not committed.
- `.vs/` is ignored.
- No console errors in local preview.
- No horizontal scroll at 360px mobile width.
- YouTube player works.
- Playlist local preview add/play/remove works.
- Chat local preview send/validation works.
- Firebase live test passed.
- `database.rules.json` is deployed.
