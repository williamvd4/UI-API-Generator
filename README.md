# UI-API-Generator – Scraping Assistant

Monorepo for a deterministic scraping assistant:

- **Backend (FastAPI + Playwright):** loads pages, captures JSON API responses, scores candidate endpoints, generates scraping configs.
- **Frontend (Next.js):** 3-column UI with browser preview, live network inspector, request details, and config output.
 - **Frontend (Next.js):** 2-column UI with live network inspector, request details, and config output.

## Requirements

- **Python:** 3.11–3.13 recommended (Playwright + Windows currently has issues on Python 3.14 subprocess APIs).
- **Node.js:** 20+
- **npm:** 10+

## Run Backend

```bash
cd backend
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows
# .venv\Scripts\activate

pip install -r requirements.txt
playwright install chromium
uvicorn app.main:app --reload
```

Backend is available at `http://localhost:8000`.

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend is available at `http://localhost:3000`.

## API Endpoints

- `GET /` – service banner
- `GET /health` – backend health + Playwright readiness status
- `POST /navigate` – `{ "url": "...", "session_id": "default" }`
- `GET /requests?session_id=default` – captured/scored request summaries
- `GET /request/{id}?session_id=default` – full request details + parsed JSON body
- `POST /generate-config` – `{ "request_id": "...", "session_id": "default" }`
- `WS /ws` – real-time request capture events

## Troubleshooting

### Backend fails on startup with `NotImplementedError` (Windows + Python 3.14)

If you see Playwright startup failure from asyncio subprocess APIs, use Python **3.13 or lower** for now, recreate the venv, and reinstall dependencies.

### Frontend build error: missing `lightningcss.win32-x64-msvc.node`

This usually means optional native dependencies were not installed.

```bash
cd frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

On Windows PowerShell, remove folders with:

```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json
npm cache clean --force
npm install
```

If your npm config disables optional packages, enable them:

```bash
npm config set optional true
npm install
```
