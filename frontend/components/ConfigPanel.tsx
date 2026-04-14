"use client";

import { useState } from "react";
import { generateConfig } from "@/lib/api";
import { useAppStore } from "@/lib/store";

function toYaml(value: unknown, depth = 0): string {
  const pad = "  ".repeat(depth);
  if (Array.isArray(value)) {
    return value.map((item) => `${pad}- ${typeof item === "object" ? `\n${toYaml(item, depth + 1)}` : String(item)}`).join("\n");
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        if (v && typeof v === "object") return `${pad}${k}:\n${toYaml(v, depth + 1)}`;
        return `${pad}${k}: ${String(v)}`;
      })
      .join("\n");
  }
  return `${pad}${String(value)}`;
}

export default function ConfigPanel() {
  const [loading, setLoading] = useState(false);
  const { selectedRequestId, sessionId, configText, setConfig, setConfigText } = useAppStore();

  async function regenerate() {
    if (!selectedRequestId) return;
    setLoading(true);
    try {
      const config = await generateConfig(selectedRequestId, sessionId);
      setConfig(config);
    } finally {
      setLoading(false);
    }
  }

  function exportText(filename: string, body: string) {
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col rounded border border-gray-700 bg-gray-900 p-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300">Config Output</h2>
        <button
          onClick={regenerate}
          disabled={loading || !selectedRequestId}
          className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-40"
        >
          {loading ? "Generating…" : "Regenerate"}
        </button>
      </div>
      <textarea
        value={configText}
        onChange={(e) => setConfigText(e.target.value)}
        placeholder="Config will appear here after generation"
        className="flex-1 rounded border border-gray-700 bg-gray-950 p-2 font-mono text-xs text-green-300"
      />
      <div className="mt-2 flex gap-2">
        <button onClick={() => exportText("config.json", configText)} className="rounded bg-gray-700 px-2 py-1 text-xs">
          Export JSON
        </button>
        <button
          onClick={() => {
            try {
              exportText("config.yaml", toYaml(JSON.parse(configText || "{}")));
            } catch {
              exportText("config.yaml", "# Invalid JSON in editor; fix JSON before YAML export\n");
            }
          }}
          className="rounded bg-gray-700 px-2 py-1 text-xs"
        >
        <button onClick={() => exportText("config.yaml", toYaml(JSON.parse(configText || "{}")))} className="rounded bg-gray-700 px-2 py-1 text-xs">
          Export YAML
        </button>
      </div>
    </div>
  );
}
