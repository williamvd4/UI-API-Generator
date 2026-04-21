# UI-API-Generator

Monorepo: FastAPI+Playwright backend (`backend/`) + Next.js frontend (`frontend/`).

## Backend

- **Entry point:** `backend/run.py` — sets `WindowsProactorEventLoopPolicy` before uvicorn starts, required for Playwright subprocess on Windows.
- **Do not use `uvicorn --reload` on Windows** — reload spawns subprocesses that break in-memory session state, causing "Request not found" 404s.
- **Python 3.13 or lower** required on Windows. Python 3.14 has incompatible subprocess APIs.
- **Run:** `cd backend && source .venv/bin/activate && playwright install chromium && python run.py` (Windows) or `uvicorn app.main:app --reload` (Linux/macOS).
- **Ports:** Backend 8000, WebSocket `/ws`.

## Frontend

- `npm run dev` (3000), `npm run build`, `npm run lint`.
- **Next.js 16 + React 19** — not older versions. Read `node_modules/next/dist/docs/` before modifying App Router patterns.
- If build fails with `lightningcss.win32-x64-msvc.node`, delete `node_modules` + `package-lock.json`, run `npm cache clean --force && npm install`.

## Key In-Memory State

Sessions (captured requests) are in-process only. If the backend process restarts, all session data is lost. This affects `GET /requests` and `GET /request/{id}` — they will return 404 for requests captured before a restart.

## Proxy Endpoint

`GET /proxy?url=...` fetches URLs server-side, injects a bridge script that posts DOM events (click, type, navigate) to the parent window. Used by the frontend iframe preview.

## Docker

```bash
cd docker && docker-compose up
```
Sets `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_WS_URL` for the frontend.

## Project Structure

```
backend/
  app/main.py          # FastAPI app, lifespan starts Playwright browser
  app/api/routes.py    # /navigate, /requests, /request/{id}, /generate-config, /proxy
  app/services/
    playwright_service.py  # Session-based browser manager, captures network requests
    analysis_service.py    # scores responses, generates scraping config
  run.py               # Windows entry point (sets event loop policy)
  requirements.txt
frontend/
  app/page.tsx         # Main 3-column UI
  components/          # UrlBar, NetworkTable, RequestDetails, ConfigPanel
  package.json         # Next.js 16.2.3, React 19, Tailwind, Zustand
```