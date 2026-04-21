"use client";

import { useState } from "react";
import { NetworkRequest } from "@/types/network";
import { fetchRequestDetail } from "@/lib/api";
import { useAppStore } from "@/lib/store";

const TYPE_COLOURS: Record<string, string> = {
  document:   "bg-blue-900 text-blue-300",
  stylesheet: "bg-purple-900 text-purple-300",
  script:     "bg-yellow-900 text-yellow-300",
  xhr:        "bg-green-900 text-green-300",
  fetch:      "bg-green-900 text-green-300",
  image:      "bg-pink-900 text-pink-300",
  graphql:    "bg-emerald-900 text-emerald-300",
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
  const [filterSet, setFilterSet] = useState<string[]>(["all"]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { networkLog, selectRequest, sessionId, selectedRequestId } = useAppStore();

  const allFilters = [
    "all",
    "xhr",
    "fetch",
    "graphql",
    "js",
    "css",
    "img",
    "media",
    "font",
    "ws",
    "doc",
    "other",
    "json",
  ] as const;

  function toggleFilter(f: string) {
    if (f === "all") return setFilterSet(["all"]);
    setFilterSet((prev) => {
      const next = new Set(prev.filter((p) => p !== "all"));
      if (next.has(f)) next.delete(f);
      else next.add(f);
      const arr = Array.from(next);
      return arr.length === 0 ? ["all"] : arr;
    });
  }

  function matchesFilter(req: NetworkRequest) {
    if (filterSet.includes("all")) return true;
    // JSON content filter
    if (filterSet.includes("json") && req.content_type.includes("application/json")) return true;
    // Map filters to Playwright resource_type or content
    for (const f of filterSet) {
      if (f === "xhr" && req.resource_type === "xhr") return true;
      if (f === "graphql" && req.resource_type === "graphql") return true;
      if (f === "fetch" && req.resource_type === "fetch") return true;
      if (f === "js" && req.resource_type === "script") return true;
      if (f === "css" && req.resource_type === "stylesheet") return true;
      if (f === "img" && req.resource_type === "image") return true;
      if (f === "media" && req.resource_type === "media") return true;
      if (f === "font" && req.resource_type === "font") return true;
      if (f === "ws" && req.resource_type === "websocket") return true;
      if (f === "doc" && req.resource_type === "document") return true;
      if (f === "other" && (req.resource_type === "other" || !req.resource_type)) return true;
    }
    return false;
  }

  const rows = networkLog.filter(matchesFilter);

  async function onSelect(requestId: string) {
    setLoadingId(requestId);
    try {
      const detail = await fetchRequestDetail(requestId, sessionId);
      selectRequest(detail);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 min-h-0 flex-1">
      {/* Filter tabs */}
      <div className="flex gap-1">
        {allFilters.map((f) => (
          <button
            key={f}
            onClick={() => toggleFilter(f)}
            className={`rounded px-3 py-1 text-xs font-medium ${
              (filterSet.includes("all") && f === "all") || (!filterSet.includes("all") && filterSet.includes(f))
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-500 self-center">{rows.length} requests</span>
      </div>

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
                  className={`cursor-pointer border-t border-gray-800 hover:bg-gray-800 align-top ${
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
                  <td className="px-2 py-1 max-w-[200px] text-gray-300" title={req.path}>
                    <div className="break-words">{req.path}</div>
                    {req.graphql_operation && (
                      <div className="text-[10px] text-gray-400">{req.graphql_operation}</div>
                    )}
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