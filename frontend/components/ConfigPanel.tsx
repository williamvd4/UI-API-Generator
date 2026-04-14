"use client";

import { useAppStore } from "@/lib/store";

/**
 * ConfigPanel – displays generated scraping config.
 * Currently a placeholder; output will be populated after config generation.
 */
export default function ConfigPanel() {
  const configOutput = useAppStore((s) => s.configOutput);

  return (
    <div className="flex-1 rounded border border-gray-700 bg-gray-900 p-2">
      <h2 className="mb-2 text-sm font-semibold text-gray-300">
        Config Output
      </h2>
      {configOutput ? (
        <pre className="whitespace-pre-wrap text-xs text-green-400">
          {configOutput}
        </pre>
      ) : (
        <p className="text-xs text-gray-600">
          Config will appear here after generation
        </p>
      )}
    </div>
  );
}
