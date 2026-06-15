# Renner Radio, Project Brief

Last updated: 2026-05-22

This file is the main source of truth for the project. Attach or paste it with every Codex prompt so Codex keeps the same direction, protects the current design, and does not lose the project idea.

## 1. Project Idea

Renner Radio is a Lo-Fi radio website with a visual style inspired by vintage radios, neon, glassmorphism, cyber visuals, and pixel art.

The project starts as a simple YouTube-based radio player. It will grow into a small social listening platform with:

- Lo-Fi, FM, and song stations.
- Themes, backgrounds, and visual effects.
- A community playlist powered by YouTube links.
- Anonymous realtime chat.
- Data storage through Firebase.
- Live deployment through Vercel or Netlify.

The goal is not to build a large app. The goal is to build a light, beautiful, fast, and simple radio experience.

## 2. Project Identity

Project name: Renner Radio

Core mood:

- Lo-Fi
- Cyber
- Neon
- Pixel Art
- Glassmorphism
- Night radio mood

Main interface language:

- Arabic with RTL direction.
- Short English UI labels are allowed, such as STATION LIST, SIGNAL, and LIVE.

## 3. Current Project State

The current project contains:

- `index.html`
- `style.css`
- `script.js`

Current notes:

- `index.html` contains HTML and some JavaScript in the same file.
- `style.css` contains most of the styling.
- `script.js` seems old or not fully aligned with the current code.
- Some player IDs are inconsistent across files.
- The station list is inside `index.html`.
- Data, logic, and styling are not clearly separated yet.
- User choices are not saved yet.
- Chat and playlist features do not exist yet.

## 4. Golden Rule

Do not change the soul of the project.

Every change must protect:

- The main radio design.
- The current visual mood.
- Simplicity.
- Fast loading.
- Mobile support.
- A low-complexity codebase.

## 5. Approved Development Roadmap

### V8, UI Upgrade and Cleanup

This is the approved first phase.

Goals:

- Upgrade the UI.
- Improve the mobile experience.
- Reorder the buttons.
- Prepare layout space for chat.
- Prepare layout space for playlist.
- Clean up the code.
- Separate files.

Tasks:

- Move JavaScript from `index.html` into `app.js`.
- Move the station list into `stations.js`.
- Create `config.js` for themes, backgrounds, and effects.
- Fix or remove the old `script.js` file.
- Improve button layout.
- Prepare a side or bottom panel for the playlist.
- Prepare a side or bottom panel for chat.
- Improve small-screen layout.
- Keep RTL support.
- Do not connect Firebase in this phase.

Expected result:

A cleaner and expandable interface, without real chat and without a database connection.

### V9, Firebase Setup

Goals:

- Create a Firebase project.
- Connect the website to Firebase.
- Prepare Firestore or Realtime Database.
- Prepare security rules.
- Prepare the data structure for links and messages.

Tasks:

- Create `firebase.js`.
- Store Firebase setup in a separate file.
- Test basic read and write operations.
- Prepare collections or nodes.
- Prepare security rules.
- Prevent spam and overly long messages.
- Prevent unauthorized edits.

Expected result:

Firebase connection works, with a data structure ready before building live features.

### V10, Playlist System

Goals:

- Build a playlist system based on YouTube links.
- Let users add a YouTube link.
- Extract the video ID from the link.
- Save the link in Firebase.
- Display the list and play items through the YouTube API.

Tasks:

- Build the add-link UI.
- Support common YouTube URL formats.
- Extract `videoId` safely.
- Reject invalid links.
- Save `videoId`, `url`, `createdAt`, and optional `name`.
- Display the playlist.
- Play an item when clicked.
- Add delete or skip controls.
- Handle videos that cannot play inside an iframe.

Expected result:

A working playlist that integrates with the current player.

### V11, Anonymous Chat

Goals:

- Build anonymous realtime chat.
- Generate random user names.
- Send and receive messages in realtime.
- Keep the experience simple.

Tasks:

- Build the chat UI.
- Generate names such as `Wolf-482`.
- Generate a simple color for each user.
- Save the name in `localStorage`.
- Send messages to Firebase.
- Receive the latest messages in realtime.
- Display only the latest 50 messages.
- Block empty messages.
- Limit message length.
- Add a simple frontend rate limit.
- Prepare Firebase rules to reduce spam.

Expected result:

A simple, fast, anonymous chat that fits the radio mood.

### V12, Deployment

Goals:

- Clean up the code.
- Review performance.
- Deploy the website live.
- Test the website on mobile and desktop.

Tasks:

- Connect the project to GitHub.
- Deploy on Vercel or Netlify.
- Test the YouTube API on the final live URL.
- Test Firebase on the final live URL.
- Review console errors.
- Add basic SEO.
- Add a favicon.
- Add a manifest later if the project becomes a PWA.

Expected result:

A stable live version of Renner Radio.

## 6. Recommended File Structure

Use this structure after cleanup:

```txt
/
  index.html
  style.css
  app.js
  stations.js
  config.js
  firebase.js
  README.md
  /assets
    /icons
    /images
    /sounds
  /docs
    BODWOLF_RADIO_PROJECT_BRIEF.md
```

If the project grows later:

```txt
/src
  app.js
  stations.js
  config.js
  firebase.js
  playlist.js
  chat.js
  storage.js
  ui.js
```

## 7. File Separation Rules

`index.html`:

- Contains structure only.
- Does not contain long logic.
- Does not contain the station list.

`style.css`:

- Contains all styling.
- Keeps themes and CSS variables.
- Contains media queries for mobile.

`app.js`:

- Manages the player.
- Manages buttons.
- Manages the YouTube API.
- Connects UI and data.

`stations.js`:

- Contains the static station list.
- Each station has `name`, `id`, `freq`, and `category`.

`config.js`:

- Contains themes.
- Contains backgrounds.
- Contains effects.

`firebase.js`:

- Contains Firebase setup.
- Does not mix chat and playlist logic in one file.

`playlist.js`:

- Handles adding YouTube links.
- Handles `videoId` extraction.
- Handles playlist display and playback.

`chat.js`:

- Handles chat.
- Handles random names.
- Handles sending and receiving messages.

`storage.js`:

- Handles `localStorage`.
- Saves theme, background, volume, last station, and chat name.

`ui.js`:

- Handles opening and closing panels.
- Handles loading and error states.
- Handles UI updates.

## 8. Station Data Model

```js
const stations = [
  {
    name: "Lofi Girl",
    id: "jfKfPfyJRdk",
    freq: "88.5",
    category: "LOFI"
  }
];
```

Required fields:

- `name`: station name.
- `id`: YouTube video ID.
- `freq`: fake radio frequency used in the UI.
- `category`: station type.

Initial categories:

- `LOFI`
- `SONG`
- `FM`

## 9. Firebase Playlist Data Model

Suggested path:

```txt
playlists/global/items/{itemId}
```

Item shape:

```js
{
  videoId: "jfKfPfyJRdk",
  url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
  title: "Optional title",
  addedBy: "Wolf-482",
  createdAt: serverTimestamp(),
  status: "active"
}
```

Rules:

- Do not save non-YouTube links.
- Do not save an item without `videoId`.
- Do not allow long titles.
- Do not allow fast repeated submissions.
- Do not load an unlimited number of items at first.

## 10. YouTube ID Extraction

Support these formats:

```txt
https://www.youtube.com/watch?v=VIDEO_ID
https://youtu.be/VIDEO_ID
https://www.youtube.com/shorts/VIDEO_ID
https://www.youtube.com/embed/VIDEO_ID
```

Rules:

- A YouTube `videoId` is usually 11 characters.
- Reject the link if no clear ID is found.
- Do not use `innerHTML` to render user input.
- Use `textContent` when rendering any user text.

## 11. Firebase Chat Data Model

Suggested path:

```txt
chat/global/messages/{messageId}
```

Message shape:

```js
{
  name: "Wolf-482",
  color: "#7dd3fc",
  text: "Hello radio",
  createdAt: serverTimestamp()
}
```

Rules:

- Maximum message length: 160 characters.
- Reject empty messages.
- Display only the latest 50 messages.
- Do not save personal data.
- Do not add login at first.
- Do not render user HTML.

## 12. Random Name System

Suggested pattern:

```txt
Wolf-123
NightWolf-482
LoFiWolf-729
```

Logic:

- Generate the name the first time the user opens the site.
- Save it in `localStorage`.
- Keep the same name for the same browser.
- Add a rename button later if needed.

## 13. localStorage Settings

Save these values locally:

```txt
bodwolf:lastStationIndex
bodwolf:volume
bodwolf:theme
bodwolf:background
bodwolf:effect
bodwolf:chatName
bodwolf:chatColor
bodwolf:favorites
bodwolf:recentStations
```

Goals:

- Restore the same state when the user opens the site again.
- Do not depend on Firebase for personal settings at first.

## 14. Mobile Interface

Mobile rules:

- Keep the radio near the top or center.
- Make buttons clear and large.
- Show chat and playlist as bottom sheets or tabs.
- Avoid crowding the screen.
- Do not show the YouTube iframe if the player is audio-first.
- The UI must work at 360px width.

Suggested mobile layout:

- Small header.
- Radio card.
- Controls.
- Tabs: Stations, Playlist, Chat.
- Bottom panel for content.

## 15. Desktop Interface

Suggested desktop layout:

- Radio in the center.
- Station list as a window or panel.
- Playlist on one side.
- Chat on the other side, or inside an openable panel.
- Top buttons stay clear.

## 16. Suggested Themes

Current themes:

- Blue default.
- Purple.
- Orange.

Suggested themes:

- Cyber Blue.
- Purple Night.
- Orange Sunset.
- Green Matrix.
- Red Arcade.
- Pink Vapor.

Each theme should use CSS variables:

```css
:root {
  --main-glow: 80, 200, 255;
  --secondary-glow: 79, 172, 254;
  --accent-color: #4facfe;
}
```

## 17. Backgrounds and Effects

Backgrounds:

- They should be switchable.
- Reduce dependency on external GIF links later.
- Move important backgrounds into `assets`.

Effects:

- Rain.
- Snow.
- Scanlines.
- Noise.
- Tuning effect when changing station.

Performance rules:

- Do not add too many heavy GIFs.
- Do not add effects that slow mobile devices.
- Provide an option to disable effects.

## 18. Later Features, Not Required Now

These are postponed until V8 to V12 are stable:

- PWA.
- Sleep Timer.
- Pomodoro Timer.
- Favorite stations.
- Recent stations.
- Share current station.
- Import and export playlist.
- Admin mode.
- Moderation tools.
- Report message.
- User profile.
- Login.

## 19. Codex Workflow Rules

When sending any task to Codex:

- Attach or paste this file as the project reference.
- Clearly define the current phase.
- Ask for one phase only per prompt.
- Tell Codex to preserve the current visual style.
- Tell Codex not to remove existing features.
- Ask Codex to explain which files it changed.
- Tell Codex not to introduce a new framework unless explicitly requested.
- Ask Codex to check for console errors.

## 20. Codex Restrictions

Codex must not do the following unless explicitly requested:

- Convert the project to React.
- Remove the radio design.
- Change the main language from Arabic.
- Change the page direction from RTL.
- Add login.
- Add a separate backend.
- Add many libraries.
- Remove the YouTube API.
- Show the iframe in a distracting way.
- Store personal data.

## 21. Success Definition Per Phase

V8 is successful when:

- Files are separated.
- Mobile is better.
- Chat and playlist spaces are ready.
- The design did not change too much.
- The project works like before.

V9 is successful when:

- Firebase is connected.
- Read and write tests work.
- Basic security rules exist.
- No major console errors appear.

V10 is successful when:

- The user adds a YouTube link.
- The ID is extracted and saved.
- The list is displayed.
- Clicking an item plays it.
- Invalid links are rejected.

V11 is successful when:

- Chat sends and receives in realtime.
- Random names work.
- Messages are limited and safe.
- The UI does not break on mobile.

V12 is successful when:

- The site is deployed.
- It works on a real URL.
- Firebase and YouTube work after deployment.
- Main errors are fixed.

## 22. Approved Decision

Start with V8 only.

V8 scope:

- UI Upgrade.
- Mobile improvements.
- Layout space for chat and playlist.
- Button reordering.
- Code cleanup.
- File separation.

Do not start Firebase now.
Do not start chat now.
Do not start playlist now.

After V8 is complete, move to V9.
