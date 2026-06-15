# Renner Radio Deployment

Renner Radio is a static frontend project. It does not need React, Next.js, Vite, a backend server, or private service account keys.

## Files Used for Deployment

- `index.html`
- `style.css`
- `app.js`
- `stations.js`
- `config.js`
- `firebase.js`
- `playlist.js`
- `chat.js`
- `admin.html`
- `admin.css`
- `admin.js`
- `firebase-config.js` generated locally or during deployment

Keep `firebase-config.example.js` in git. Keep real `firebase-config.js` ignored and out of commits.

## Firebase Config Strategy

Local setup:

1. Copy `firebase-config.example.js` to `firebase-config.js`.
2. Paste the Firebase Web App config.
3. Run the app locally.
4. Do not commit `firebase-config.js`.

Deployment setup:

1. Add these environment variables in Vercel or Netlify:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_DATABASE_URL`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
2. The build command runs `npm run build`.
3. `scripts/create-firebase-config.js` generates `firebase-config.js` from environment variables.
4. The script never prints config values.
5. If a required variable is missing, the build fails with a clear missing-variable list.

Static preview still works without `firebase-config.js`; Firebase features fall back to local preview mode.

## Realtime Database Rules

Deploy `database.rules.json` before testing live temporary channels, chat, or Studio Panel station writes.

Options:

- Firebase console: Realtime Database -> Rules -> paste `database.rules.json`.
- Firebase CLI: deploy database rules from this project.

Required Firebase services:

- Firebase Web App
- Realtime Database
- Anonymous Authentication
- Google Authentication for the private V16 Studio Panel

## V16 Studio Panel Setup

The Studio Panel is private by direct URL only:

```txt
http://127.0.0.1:4173/admin.html
```

Do not add a public Admin button to `index.html`.

Setup steps:

1. Enable Google sign-in in Firebase Authentication.
2. Open `admin.html`.
3. Sign in with Google.
4. Copy the UID shown in the Admin Status card.
5. Paste that UID into `admin.js`:

```txt
const ADMIN_UID = "PASTE_ADMIN_UID_HERE";
```

6. Confirm `database.rules.json` uses the same UID for `/adminStations` and `/siteSettings` writes.
7. Publish the updated Realtime Database rules.
8. Reopen `admin.html` and sign in again.
9. Confirm the Studio Panel tools appear.

V16.2 writes Studio Panel station records to:

```txt
/adminStations/{stationId}
```

V16.2 writes placeholder site settings to:

```txt
/siteSettings
```

V16.2 public dashboard behavior:

- Active Studio Panel stations in `/adminStations` become the main station list.
- Built-in `stations.js` stations are fallback and seed data only.
- If `/adminStations` has no valid active stations, is empty, or cannot be read, the dashboard uses `stations.js`.
- Admin stations are displayed as normal main stations, not as a separate `STUDIO FM` group.
- Temporary community channels still appear separately as `COMMUNITY FM`.
- Disabled or removed Studio stations are hidden from the public Station Grid.
- If `/adminStations` returns `permission_denied`, deploy the current `database.rules.json` and confirm the rules use the same admin UID as `admin.js`.

Studio station media fields are plain URLs for external hosted media. V16.2 does not upload files to Firebase Storage.

Import Default Stations:

1. Sign into `admin.html` with the Studio admin Google account.
2. Click `Import Default Stations`.
3. The built-in `stations.js` records are copied into `/adminStations` with stable seed IDs.
4. Existing admin records are skipped, not overwritten.
5. Edit, disable, or replace those imported stations from Station Manager.

Studio Panel smoke test:

1. Save a station.
2. Confirm it appears in the Station List.
3. Edit the station and save again.
4. Disable the station.
5. Mark it removed or delete it.
6. Sign out.
7. Confirm a non-admin Google UID shows `Access denied`.

V16.2 public Station Grid test:

1. Deploy `database.rules.json`.
2. Sign into `admin.html` with the Studio admin Google account.
3. Click `Import Default Stations`.
4. Confirm the Station List fills with imported stations.
5. Edit one station and save it.
6. Disable one station.
7. Add a new station; frequency should auto-generate.
8. Open `index.html` in another tab.
9. Confirm the public Station Grid uses the admin-managed stations as the main station list.
10. Confirm disabled stations do not appear publicly.
11. Confirm there is no separate `STUDIO FM` group.
12. Confirm temporary community channels still appear separately as `COMMUNITY FM`.

If live saves fail, check the browser console for the exact path. V16.3 writes to `/adminStations` and `/siteSettings`; `permission_denied` usually means the latest rules were not deployed or the admin UID differs between `admin.js` and `database.rules.json`.

## V16.3 Station Management Cleanup

V16.3 keeps the same Firebase paths, but improves organization:

- The public Station Grid shows clean category divider blocks without public category filter chips.
- Admin-managed stations remain the main station list when `/adminStations` has valid active records.
- `stations.js` remains fallback and seed data only.
- `COMMUNITY FM` remains a separate public station divider when community channels exist.
- Studio Panel Station List now has search, status filter, category filter, and sort controls.
- Station cards show compact metadata, status, sort order, and YouTube readiness.
- Maintenance Tools can find duplicate stations, mark duplicate extras removed, and recalculate sort order.
- UI polish/redesign is still deferred to a later phase.

V16.3 public QA checklist:

1. Open the public dashboard.
2. Confirm public category filter chips do not appear.
3. Confirm category dividers appear once per category.
4. Confirm station click/play still works.
5. Confirm `COMMUNITY FM` remains separate when community channels are active.
6. Confirm mobile 360px has no horizontal scroll.

## V16.4 Brand Rename Checklist

- Public dashboard title and topbar use `Renner Radio`.
- Studio Panel title and topbar use `Renner Studio Panel`.
- Brand marks use `RR`.
- Firebase paths remain unchanged: `/adminStations`, `/temporaryStations`, `/chatMessages`, `/userProfiles`, and `/siteSettings`.
- Real `firebase-config.js` remains ignored and uncommitted.

V16.3 Studio Panel QA checklist:

1. Search stations by name, frequency, or category.
2. Filter Active, Disabled, Removed, and All.
3. Filter by category.
4. Sort by sort order, name, frequency, and recently updated.
5. Edit a station and save changes.
6. Disable and enable a station.
7. Mark a station removed.
8. Confirm Delete still asks for confirmation.
9. Run Find Duplicates.
10. Mark duplicate stations removed after preview.
11. Recalculate sort order after confirmation.
12. Confirm Import Default Stations still skips existing records.
13. Refresh the public dashboard and confirm changes appear.

Studio Panel troubleshooting:

- Open the Studio Panel from `http://localhost:4173/admin.html` or `http://127.0.0.1:4173/admin.html`.
- Use a normal browser window for local Google login testing, not incognito/private mode.
- Add both `127.0.0.1` and `localhost` to Firebase Authentication authorized domains.
- Enable the Google provider in Firebase Authentication.
- Keep `ADMIN_UID` in `admin.js` as one line, for example `const ADMIN_UID = "YOUR_GOOGLE_UID";`.
- Confirm `database.rules.json` uses the same UID as `ADMIN_UID` before publishing rules.
- Use Ctrl+F5 after editing `admin.js` so the browser does not keep an old cached module.
- If a redirect loop happens, clear site data for `localhost`, `127.0.0.1`, `accounts.google.com`, and the Firebase auth handler domain, then reload.
- Public `firebase.js` skips anonymous auth bootstrap on `admin.html`; the admin page clears any persisted anonymous visitor session before Google login.
- The Studio Panel uses Google popup login first, with redirect login available as the fallback.
- If sign-in fails, the Studio Panel shows the Firebase auth code, such as `auth/unauthorized-domain`, `auth/popup-blocked`, `auth/popup-closed-by-user`, or `auth/network-request-failed`.
- V16.2 Station Manager accepts disabled drafts without a YouTube link, but active stations require a valid YouTube ID.
- Deeper Studio Panel UI polish is intentionally deferred until after V16.2.

## Test Before Deployment

Run:

```txt
npm run check
```

Run locally:

```txt
npm run start
```

Open:

```txt
http://127.0.0.1:4173/
```

Without `firebase-config.js`, confirm:

- App loads.
- `stations.js` fallback still appears if Firebase is unavailable or no valid active admin station exists.
- Radio plays stations.
- Random station works.
- Theme, background, and visual effects work.
- Temporary community channel local preview create/add-track/countdown/tune/remove works.
- Chat local preview send/validation works.
- Firebase status shows static mode.
- No console errors.

With Firebase configured, confirm active `/adminStations` records become the main public station list and `stations.js` does not duplicate beneath them.

## Deploy to Vercel

1. Import the repository into Vercel.
2. Use the project root as the root directory.
3. Keep the framework preset as static or other/no framework.
4. Set Build Command to:

```txt
npm run build
```

5. Set Output Directory to:

```txt
.
```

6. Add the Firebase environment variables listed above.
7. Deploy.
8. Open the preview URL and check the browser console.

`vercel.json` stores the same minimal build command and output directory for this static project.

## Deploy to Netlify

1. Import the repository into Netlify.
2. Use the project root as the base directory.
3. Set Build Command to:

```txt
npm run build
```

4. Set Publish Directory to:

```txt
.
```

5. Add the Firebase environment variables listed above.
6. Deploy.
7. Open the deploy preview and check the browser console.

`netlify.toml` stores the same minimal build command and publish directory.

## Live Temporary Community Channel Test

1. Confirm the console shows `Firebase ready.`
2. Confirm the smoke test passes.
3. Open the deployed site in two browser tabs.
4. Create one temporary channel from a YouTube link in tab one.
5. Add a second YouTube link to the same channel after the 30 second add delay.
6. Confirm one channel appears under `>>> COMMUNITY FM <<<` in the Station Grid in both tabs.
7. Confirm the channel card shows its active track count.
8. Tune into the temporary channel from tab two.
9. Confirm the hero and bottom player show the channel name and current track title.
10. Remove one track from the owner tab.
11. Remove the channel from the owner tab.
12. Confirm it disappears from both tabs.
13. Try adding the same active video again and confirm duplicate rejection.
14. Try adding another track before 30 seconds and confirm the rate-limit message.
15. Check `/temporaryStations/{stationId}/tracks/{trackId}` in Realtime Database.

Expired temporary channels are hidden by the client. V15.3 does not hard delete expired records.

## V15.3 Temporary Community Channel Manual Test

Deploy the updated `database.rules.json` after V15.3 before testing live temporary channel and track writes.

1. Open the app in two browser tabs.
2. Confirm both tabs show `Firebase ready.`
3. Make sure the current browser has a valid custom English radio name.
4. Create a temporary channel with a valid YouTube link.
5. Add a second valid YouTube link to the same channel.
6. Confirm the Station Grid shows one community channel, not one station per track.
7. Confirm the channel row shows the active track count.
8. Click the community channel and confirm the first active track plays.
9. Confirm the next active track plays after the current YouTube track ends, looping back after the last track.
10. Remove one track from the owner tab.
11. Remove the channel from the owner tab.
12. Confirm it disappears in both tabs.
13. Add the same active video again and confirm duplicate rejection.
14. Try adding another track before 30 seconds and confirm the rate-limit message.
15. Confirm expired channels hide after `expiresAt`.

## Live Chat Test

1. Open the deployed site in two browser tabs.
2. Confirm both tabs show Firebase chat sync.
3. Send a chat message in tab one.
4. Confirm it appears in tab two.
5. Test empty message rejection.
6. Test the 160 character limit.
7. Test the 2 second rate limit.
8. Check `/chatMessages` and `/userProfiles` in Realtime Database.

## Mobile Layout Test

Test at 360px width:

- No horizontal scroll.
- Radio card stays centered.
- Temporary channel panel scrolls internally.
- Chat panel scrolls internally.
- Send button is easy to tap.
- Footer does not overlap the player.

## Optional Radio Static Audio

V14.1 supports a short, low-volume radio static sound during station changes.

- Put the optional file at `assets/audio/radio-static.mp3`.
- Do not commit copyrighted audio.
- If the file is missing, the app continues normally and logs one safe warning only when Static Sound is enabled.
- Static Sound is off by default and is saved in `localStorage` when enabled.
- Comfort Mode reduces motion and keeps static sound off or quieter.
- `prefers-reduced-motion` is respected: the visual tuning effect becomes a gentle fade.

## Pre-deployment Checklist

- Firebase config ready.
- Firebase Anonymous Authentication enabled.
- Realtime Database enabled.
- `database.rules.json` deployed.
- Google Authentication enabled for `admin.html`.
- V16.2 `ADMIN_UID` pasted into `admin.js` and `database.rules.json`.
- Studio Panel save/edit/disable tested.
- `Import Default Stations` tested.
- Admin-managed main stations appear in the public Station Grid.
- Smoke test passed.
- Temporary community channel create, add-track, countdown, tune, owner remove, and rate limit tested.
- Chat tested in two browser tabs.
- Mobile 360px tested.
- No console errors.
- `firebase-config.js` not committed.
- `.vs/` not committed.
