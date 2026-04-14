"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { interact, screenshotUrl } from "@/lib/api";
import { useAppStore } from "@/lib/store";

/** Refresh screenshot every N ms in idle state */
const IDLE_INTERVAL_MS = 3000;
/** Refresh screenshot after an interaction after this delay */
const INTERACTION_DELAY_MS = 600;

export default function BrowserView() {
  const sessionId = useAppStore((s) => s.sessionId);
  const setUrl = useAppStore((s) => s.setUrl);
  const [src, setSrc] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Screenshot refresh ──────────────────────────────────────────────────
  const refreshScreenshot = useCallback(async () => {
    const nextSrc = screenshotUrl(sessionId);
    try {
      const res = await fetch(nextSrc, { method: "GET" });
      if (!res.ok) throw new Error(`Screenshot unavailable (${res.status})`);
      setSrc(nextSrc);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [sessionId]);

  // Idle polling
  useEffect(() => {
    refreshScreenshot();
    idleIntervalRef.current = setInterval(refreshScreenshot, IDLE_INTERVAL_MS);
    return () => {
      if (idleIntervalRef.current) clearInterval(idleIntervalRef.current);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [refreshScreenshot]);

  // ── Interaction helpers ─────────────────────────────────────────────────
  function getNormalisedCoords(clientX: number, clientY: number): { x: number; y: number } {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }

  function scheduleRefresh() {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(refreshScreenshot, INTERACTION_DELAY_MS);
  }

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      if (busy) return;
      setBusy(true);
      const { x, y } = getNormalisedCoords(e.clientX, e.clientY);
      try {
        const result = await interact("click", x, y, sessionId);
        // Update URL bar if navigation happened
        if (result.current_url) setUrl(result.current_url);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
        scheduleRefresh();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, sessionId, setUrl],
  );

  const handleWheel = useCallback(
    async (e: React.WheelEvent<HTMLDivElement>) => {
      if (busy) return;
      const { x, y } = getNormalisedCoords(e.clientX, e.clientY);
      try {
        await interact("scroll", x, y, sessionId, "", Math.round(e.deltaY));
      } catch {
        /* ignore scroll errors */
      }
      scheduleRefresh();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, sessionId],
  );

  return (
    <div className="flex flex-1 flex-col rounded border border-gray-700 bg-gray-900 p-2">
      <h2 className="mb-2 text-sm font-semibold text-gray-300">
        Browser View
        {busy && <span className="ml-2 text-xs font-normal text-blue-400 animate-pulse">working…</span>}
      </h2>

      {/* Interactive screenshot overlay */}
      <div
        ref={containerRef}
        onClick={handleClick}
        onWheel={handleWheel}
        className={`relative flex-1 min-h-0 overflow-hidden rounded bg-gray-800 ${
          busy ? "cursor-wait" : "cursor-crosshair"
        }`}
        style={{ minHeight: "28rem" }}
      >
        {src ? (
          <Image
            src={src}
            alt="Playwright session screenshot"
            fill
            unoptimized
            className="object-contain select-none pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            {error ? "" : "Navigate to a URL to see the browser."}
          </div>
        )}

        {/* Busy overlay */}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-sm text-white">…</span>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-yellow-400">{error}</p>}
      <p className="mt-1 text-[10px] text-gray-600">Click to interact · Scroll to scroll the page</p>
    </div>
  );
}

