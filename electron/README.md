# Electron BrowserView Example

This directory contains a minimal, self-contained Electron example that embeds a **full, persistent Chromium browser instance** inside a `BrowserView`. It is intended as a drop-in reference for contributors who want to run a desktop shell with the following features:

- Persistent cookies and `localStorage` across restarts (via a named session partition)
- Fully functional `window.open` / popup windows that share the same session
- File downloads with progress logging
- Permission-request handling (e.g. notifications)
- DevTools attached to the `BrowserView` for debugging
- A minimal, safe `preload` bridge (`window.electronAPI.openExternal`)

---

## Quick start

```bash
cd electron
npm install
```

### Point at a local dev server (e.g. Next.js on port 3000)

```bash
npm run start:dev
```

This sets `START_URL=http://localhost:3000` via `cross-env` before launching Electron.

### Point at a production build or any URL

```bash
# Static file build
START_URL=file:///absolute/path/to/dist/index.html npm start

# Remote URL
START_URL=https://example.com npm start

# No env var — defaults to https://example.com
npm start
```

---

## Where session data is stored

Electron stores the persisted session (partition name `persist:browserview-profile`) inside the app's **user data directory**. The exact path depends on the platform:

| Platform | Path |
|----------|------|
| macOS    | `~/Library/Application Support/<app-name>/Partitions/browserview-profile/` |
| Windows  | `%APPDATA%\<app-name>\Partitions\browserview-profile\` |
| Linux    | `~/.config/<app-name>/Partitions/browserview-profile/` |

Delete this directory to start with a clean session.

---

## Security reminders

- **`nodeIntegration: false`** and **`contextIsolation: true`** are set on every `webPreferences` object — never enable `nodeIntegration` for untrusted content.
- **Keep `preload.js` minimal.** Only expose what the page strictly needs. Never pass raw `require` or Node APIs through `contextBridge`.
- **Keep Electron up to date.** Electron ships Chromium, so each release contains security patches. Run `npm outdated` and upgrade regularly.
- For pages that load arbitrary third-party content, consider running them in a separate session partition or a sandboxed renderer process.
