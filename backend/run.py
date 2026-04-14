"""Entry-point for running the backend on Windows.

Sets WindowsProactorEventLoopPolicy BEFORE uvicorn creates its event loop,
which is required for Playwright to spawn its browser subprocess.
Run with:  python run.py
"""

import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import uvicorn  # noqa: E402  (import after policy is set)

if __name__ == "__main__":
    # Disable auto-reload to keep Playwright and in-memory session state
    # consistent in a single process. Reload spawns subprocesses which
    # break shared in-memory state (captured requests, sessions), causing
    # 404s like "Request not found" when the HTTP worker differs from
    # the process that captured the request.
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)
