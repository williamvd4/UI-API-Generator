"use client";

import { useAppStore } from "@/lib/store";

/**
 * NetworkTable – displays HTTP responses captured by the backend.
 * Currently a placeholder; rows will be populated via WebSocket events.
 */
export default function NetworkTable() {
  const networkLog = useAppStore((s) => s.networkLog);

  return (
    <div className="flex-1 overflow-auto rounded border border-gray-700 bg-gray-900 p-2">
      <h2 className="mb-2 text-sm font-semibold text-gray-300">
        Network Inspector
      </h2>
      <table className="w-full text-xs text-gray-400">
        <thead>
          <tr className="border-b border-gray-700 text-left">
            <th className="py-1 pr-2">Status</th>
            <th className="py-1 pr-2">Content-Type</th>
            <th className="py-1">URL</th>
          </tr>
        </thead>
        <tbody>
          {networkLog.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-4 text-center text-gray-600">
                No requests captured yet
              </td>
            </tr>
          ) : (
            networkLog.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-800">
                <td className="py-1 pr-2">{entry.status}</td>
                <td className="py-1 pr-2">{entry.contentType}</td>
                <td className="py-1 max-w-xs"><div className="truncate">{entry.url}</div></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
