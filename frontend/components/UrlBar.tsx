"use client";

import { useState } from "react";
import { fetchRequests, navigate } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export default function UrlBar() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { url, setUrl, sessionId, setRequests } = useAppStore();

  async function handleGo() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await navigate(url, sessionId);
      const requests = await fetchRequests(sessionId);
      setRequests(requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full items-center gap-2">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleGo()}
        placeholder="https://example.com"
        className="flex-1 rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <button
        onClick={handleGo}
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {loading ? "Loading…" : "Go"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
