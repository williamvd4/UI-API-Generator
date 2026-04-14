"use client";

import { useAppStore } from "@/lib/store";

export default function RequestDetails() {
  const request = useAppStore((s) => s.selectedRequest);

  if (!request) {
    return (
      <div className="rounded border border-gray-700 bg-gray-900 p-3 text-xs text-gray-500">
        Select a request to inspect headers, params, and JSON payload.
      </div>
    );
  }

  let params: Record<string, string> = {};
  try {
    const parsed = new URL(request.url);
    params = Object.fromEntries(parsed.searchParams.entries());
  } catch {
    params = {};
  }

  return (
    <div className="flex-1 overflow-auto rounded border border-gray-700 bg-gray-900 p-3 text-xs text-gray-300">
      <h3 className="mb-2 text-sm font-semibold text-gray-200">Request Details</h3>
      <p className="mb-2 break-all text-[11px] text-blue-300">{request.url}</p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <div className="mb-1 text-gray-400">Headers</div>
          <pre className="max-h-32 overflow-auto rounded bg-gray-800 p-2">{JSON.stringify(request.headers, null, 2)}</pre>
        </div>
        <div>
          <div className="mb-1 text-gray-400">Params</div>
          <pre className="max-h-32 overflow-auto rounded bg-gray-800 p-2">{JSON.stringify(params, null, 2)}</pre>
        </div>
      </div>
      <div className="text-gray-400">JSON</div>
      <pre className="max-h-72 overflow-auto rounded bg-gray-800 p-2 text-[11px]">{JSON.stringify(request.json, null, 2)}</pre>
    </div>
  );
}
