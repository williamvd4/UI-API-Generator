"use client";

import { useMemo, useState } from "react";
import { fetchRequestDetail } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export default function NetworkTable() {
  const [jsonOnly, setJsonOnly] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { networkLog, selectRequest, sessionId, selectedRequestId } = useAppStore();

  const rows = useMemo(
    () =>
      [...networkLog]
        .filter((entry) => (jsonOnly ? entry.content_type.includes("application/json") : true))
        .sort((a, b) => b.score - a.score),
    [networkLog, jsonOnly],
  );

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
    <div className="rounded border border-gray-700 bg-gray-900 p-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300">Network Inspector</h2>
        <label className="text-xs text-gray-400">
          <input className="mr-1" type="checkbox" checked={jsonOnly} onChange={(e) => setJsonOnly(e.target.checked)} />
          JSON only
        </label>
      </div>
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="border-b border-gray-700 text-left text-gray-400">
              <th className="py-1 pr-2">URL</th>
              <th className="py-1 pr-2">Method</th>
              <th className="py-1 pr-2">Status</th>
              <th className="py-1 pr-2">Size</th>
              <th className="py-1">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr
                key={entry.id}
                onClick={() => onSelect(entry.id)}
                className={`cursor-pointer border-b border-gray-800 ${selectedRequestId === entry.id ? "bg-gray-800" : ""}`}
              >
                <td className="max-w-[220px] truncate py-1 pr-2">{entry.path}</td>
                <td className="py-1 pr-2">{entry.method}</td>
                <td className="py-1 pr-2">{entry.status}</td>
                <td className="py-1 pr-2">{entry.size}</td>
                <td className="py-1">{loadingId === entry.id ? "…" : entry.score.toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-center text-gray-600">
                  No requests captured yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
