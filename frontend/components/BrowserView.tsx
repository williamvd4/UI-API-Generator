"use client";

import { useEffect, useState } from "react";
import { screenshotUrl } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export default function BrowserView() {
  const sessionId = useAppStore((s) => s.sessionId);
  const [src, setSrc] = useState<string>(screenshotUrl(sessionId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = async () => {
      const nextSrc = screenshotUrl(sessionId);
      try {
        const res = await fetch(nextSrc, { method: "GET" });
        if (!res.ok) throw new Error(`Screenshot unavailable (${res.status})`);
        setSrc(nextSrc);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    refresh();
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, [sessionId]);

  return (
    <div className="flex-1 rounded border border-gray-700 bg-gray-900 p-2">
      <h2 className="mb-2 text-sm font-semibold text-gray-300">Browser View</h2>
      <div className="relative h-[28rem] w-full overflow-hidden rounded bg-gray-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Playwright session screenshot" className="h-full w-full object-contain" />
      </div>
      {error && <p className="mt-2 text-xs text-yellow-400">{error}</p>}
    </div>
  );
}
