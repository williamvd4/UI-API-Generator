# UI-API-Generator – Scraping Assistant

A full-stack monorepo for a **Playwright-based web scraping assistant** with:

- 🌐 **Browser View** – placeholder for a live browser preview
- 🔬 **Network Inspector** – captures HTTP responses from Playwright
- ⚙️ **Config Generator** – displays generated scraping config (coming soon)

---

## Tech Stack

| Layer    | Technology                       |
|----------|----------------------------------|
| Backend  | Python · FastAPI · Playwright    |
| Frontend | Next.js · TypeScript · Tailwind  |
| State    | Zustand                          |

---

## Project Structure

```
/backend
  /app
    main.py            ← FastAPI entry-point, WebSocket endpoint
    api/routes.py      ← POST /navigate
    services/playwright_service.py
    models/schemas.py
  requirements.txt

/frontend
  /app                 ← Next.js App Router pages
  /components          ← Layout, NetworkTable, ConfigPanel, UrlBar
  /lib                 ← Zustand store, WebSocket client
  package.json

README.md
```

---

## Setup & Running

### Backend

```bash
cd backend

# Create and activate a virtual environment (optional but recommended)
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browser binaries
playwright install chromium

# Start the server (reloads on file changes)
uvicorn app.main:app --reload
```

The API will be available at **http://localhost:8000**.

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy and edit environment variables
cp .env.local.example .env.local

# Start the dev server
npm run dev
```

The frontend will be available at **http://localhost:3000**.

---

## API Endpoints

| Method | Path        | Description                          |
|--------|-------------|--------------------------------------|
| GET    | `/`         | Health check                         |
| POST   | `/navigate` | `{ url }` – tell Playwright to navigate |
| WS     | `/ws`       | WebSocket echo (events coming soon)  |

---

## Environment Variables

### Frontend (`frontend/.env.local`)

| Variable                   | Default                        |
|----------------------------|--------------------------------|
| `NEXT_PUBLIC_API_URL`      | `http://localhost:8000`        |
| `NEXT_PUBLIC_API_WS_URL`   | `ws://localhost:8000/ws`       |
