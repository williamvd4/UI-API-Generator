"use client";

import { useState } from "react";
import { fetchRequestDetail } from "@/lib/api";
import { useAppStore } from "@/lib/store";

const TYPE_COLOURS: Record<string, string> = {
  document:   "bg-blue-900 text-blue-300",
  stylesheet: "bg-purple-900 text-purple-300",
  script:     "bg-yellow-900 text-yellow-300",
  xhr:        "bg-green-900 text-green-300",
  fetch:      "bg-green-900 text-green-300",
  image:      "bg-pink-900 text-pink-300",
  font:       "bg-orange-900 text-orange-300",
  websocket:  "bg-cyan-900 text-cyan-300",
};

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NetworkTable() {
  const [filter, setFilter] = useState<"all" | "xhr" | "json">("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const { networkLog, selectRequest, sessionId, selectedRequestId } = useAppStore();

  const rows =
    filter === "xhr"
      ? networkLog.filter((e) => e.resource_type === "xhr" || e.resource_type === "fetch")
      : filter === "json"
      ? networkLog.filter((e) => e.content_type.includes("application/json"))
      : networkLog;

  async function onSelect(requestId: string) {
    setLoadingId(requestId);
    setSelectError(null);
    try {
      const detail = await fetchRequestDetail(requestId, sessionId);
      selectRequest(detail);
    } catch (err) {
      setSelectError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 min-h-0 flex-1">
      {/* Filter tabs */}
      <div className="flex gap-1">
        {(["all", "xhr", "json"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded px-3 py-1 text-xs font-medium ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-500 self-center">{rows.length} requests</span>
      </div>

      {selectError && (
        <p className="rounded border border-red-700 bg-red-950 px-3 py-1 text-xs text-red-300">
          {selectError}
        </p>
      )}

      {/* Table */}
      <div className="flex-1 overflow-y-auto rounded border border-gray-700 min-h-0">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            No network requests captured yet. Navigate to a URL.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-900 text-gray-400">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Method</th>
                <th className="px-2 py-1 text-left font-medium">Status</th>
                <th className="px-2 py-1 text-left font-medium">Type</th>
                <th className="px-2 py-1 text-left font-medium w-full">Path</th>
                <th className="px-2 py-1 text-right font-medium">Size</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => onSelect(req.id)}
                  className={`cursor-pointer border-t border-gray-800 hover:bg-gray-800 ${
                    req.id === selectedRequestId ? "bg-gray-800 ring-1 ring-inset ring-blue-600" : ""
                  } ${loadingId === req.id ? "opacity-50" : ""}`}
                >
                  <td className="px-2 py-1 font-mono text-gray-300">{req.method}</td>
                  <td className={`px-2 py-1 font-mono ${req.status < 400 ? "text-green-400" : "text-red-400"}`}>
                    {req.status}
                  </td>
                  <td className="px-2 py-1">
                    <span
                      className={`rounded px-1 py-0.5 text-[10px] ${
                        TYPE_COLOURS[req.resource_type] ?? "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {req.resource_type}
                    </span>
                  </td>
                  <td className="px-2 py-1 max-w-[200px] truncate text-gray-300" title={req.path}>
                    {req.path}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-400">{formatSize(req.size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}