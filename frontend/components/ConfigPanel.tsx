"use client";

import { useEffect, useMemo, useState } from "react";
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

function collectPayloadPaths(value: unknown): string[] {
  const paths = new Set<string>();

  function walk(node: unknown, currentPath: string) {
    if (node === null || typeof node !== "object") {
      if (currentPath) paths.add(currentPath);
      return;
    }

    if (Array.isArray(node)) {
      const arrayPath = currentPath ? `${currentPath}[]` : "[]";
      if (node.length === 0) {
        paths.add(arrayPath);
        return;
      }
      paths.add(arrayPath);
      const sample = node.find((item) => item && typeof item === "object") ?? node[0];
      walk(sample, arrayPath);
      return;
    }

    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj).sort()) {
      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      walk(obj[key], nextPath);
    }
  }

  walk(value, "");
  return Array.from(paths);
}

function getPayloadValue(value: unknown, path: string): unknown {
  if (value === null || typeof value !== "object") return undefined;

  const parts = path.split(".");
  let current: unknown = value;

  for (const part of parts) {
    const isArray = part.endsWith("[]");
    const key = isArray ? part.slice(0, -2) : part;

    if (current === null || typeof current !== "object") return undefined;

    if (isArray && key === "") {
      if (!Array.isArray(current) || current.length === 0) return undefined;
      current = current[0];
      continue;
    }

    const obj = current as Record<string, unknown>;
    current = obj[key];
    if (current === undefined) return undefined;
    if (isArray) {
      if (!Array.isArray(current) || current.length === 0) return undefined;
      current = current[0];
    }
  }

  return current;
}

function normalizeFieldPath(path: string): string {
  return path.replace(/^\[\]\.?/, "");
}

function buildOutputConfig(
  config: Record<string, unknown>,
  selectedFields: string[] = [],
  requestHeaders: Record<string, unknown> = {},
): Record<string, unknown> {
  const headers = Object.keys(requestHeaders).length > 0 ? requestHeaders : config.headers ?? {};

  const output: Record<string, unknown> = {
    endpoint: config.endpoint,
    method: config.method,
    headers,
    params: config.params ?? {},
  };
  const fieldsToUse = selectedFields.length
    ? selectedFields
    : Array.isArray(config.selected_fields)
    ? config.selected_fields.map((field) => String(field))
    : [];
  if (fieldsToUse.length > 0) {
    output.selected_fields = fieldsToUse;
  }
  return output;
}

export default function ConfigPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldSelection, setFieldSelection] = useState<Record<string, boolean>>({});
  const { selectedRequestId, selectedRequest, sessionId, config, configText, setConfig, setConfigText } = useAppStore();

  const payloadFieldKeys = useMemo(() => {
    if (!selectedRequest?.json) return [];
    return collectPayloadPaths(selectedRequest.json);
  }, [selectedRequest]);

  const examplePayload = useMemo(() => {
    if (!selectedRequest?.json || payloadFieldKeys.length === 0) return null;
    const examplePath = payloadFieldKeys[0];
    const value = getPayloadValue(selectedRequest.json, examplePath);
    return {
      path: examplePath,
      value,
    };
  }, [selectedRequest, payloadFieldKeys]);

  const fieldExamples = useMemo(() => {
    if (!selectedRequest?.json) return {} as Record<string, unknown>;
    return Object.fromEntries(
      payloadFieldKeys.map((key) => [key, getPayloadValue(selectedRequest.json, key)]),
    ) as Record<string, unknown>;
  }, [selectedRequest, payloadFieldKeys]);

  useEffect(() => {
    if (payloadFieldKeys.length === 0) {
      setFieldSelection({});
      return;
    }
    setFieldSelection((current) =>
      Object.fromEntries(payloadFieldKeys.map((key) => [key, key in current ? current[key] : true])),
    );
  }, [payloadFieldKeys]);

  useEffect(() => {
    if (!config) return;
    const selectedFields = Object.entries(fieldSelection)
      .filter(([, enabled]) => enabled)
      .map(([key]) => normalizeFieldPath(key));
    const existingFields = Array.isArray(config.selected_fields)
      ? config.selected_fields.map((field) => String(field))
      : [];

    const shouldUpdate =
      selectedFields.length !== existingFields.length ||
      selectedFields.some((field, index) => existingFields[index] !== field);

    if (!shouldUpdate) return;

    const updatedConfig = {
      ...config,
      selected_fields: selectedFields,
      headers: selectedRequest?.headers ?? config.headers,
    };
    setConfig(updatedConfig);
    setConfigText(
      JSON.stringify(
        buildOutputConfig(updatedConfig, selectedFields, selectedRequest?.headers ?? {}),
        null,
        2,
      ),
    );
  }, [fieldSelection, config, selectedRequest, setConfig, setConfigText]);

  async function regenerate() {
    if (!selectedRequestId || !selectedRequest) return;
    setLoading(true);
    setError(null);
    try {
      const generated = await generateConfig(selectedRequest.id, sessionId);
      const generatedConfig = {
        ...generated,
        headers: selectedRequest.headers ?? generated.headers,
      };
      setConfig(generatedConfig);
      setConfigText(
        JSON.stringify(
          buildOutputConfig(generatedConfig, [], selectedRequest.headers ?? {}),
          null,
          2,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Request not found")) {
        setError("Selected request is no longer available. Please reselect a request from the network table.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: string, enabled: boolean) {
    setFieldSelection((prev) => ({ ...prev, [field]: enabled }));
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

  const fieldKeys = payloadFieldKeys;

  return (
    <div className="flex h-full min-h-0 flex-col rounded border border-gray-700 bg-gray-900 p-2">
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
      <p className="mb-2 text-[11px] text-gray-500">
        Regenerate preserves required config fields and lets you choose which payload fields to include in selected_fields.
      </p>

      {error && (
        <div className="mb-2 rounded border border-red-700 bg-red-950 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {fieldKeys.length > 0 && (
        <div className="mb-3 rounded border border-gray-700 bg-gray-950 p-3 text-xs text-gray-200">
          <div className="mb-2 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-medium">Pick fields to scrape</span>
                {examplePayload && (
                  <span className="text-[11px] text-gray-300 block min-w-0 overflow-hidden whitespace-nowrap text-ellipsis">
                    Example: <span className="font-mono text-xs text-green-300">{examplePayload.path}</span>
                    <span className="text-gray-400"> =&nbsp;</span>
                    <span className="text-[11px] text-gray-200">{JSON.stringify(examplePayload.value)}</span>
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => fieldKeys.forEach((key) => updateField(key, true))}
                  className="rounded bg-gray-700 px-2 py-1 text-[10px]"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => fieldKeys.forEach((key) => updateField(key, false))}
                  className="rounded bg-gray-700 px-2 py-1 text-[10px]"
                >
                  None
                </button>
              </div>
            </div>
          </div>
          <div className="max-h-44 overflow-auto pr-1">
            <div className="grid grid-cols-2 gap-2">
              {fieldKeys.map((field) => {
                const exampleValue = fieldExamples[field];
                return (
                  <label key={field} className="flex flex-col gap-1 rounded bg-gray-900 px-2 py-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={fieldSelection[field] ?? true}
                        onChange={(e) => updateField(field, e.target.checked)}
                        className="text-blue-400"
                      />
                      <span className="truncate text-sm">{normalizeFieldPath(field)}</span>
                    </div>
                    {exampleValue !== undefined && (
                      <span className="text-[10px] text-gray-400 block min-w-0 overflow-hidden whitespace-nowrap text-ellipsis">
                        {JSON.stringify(exampleValue)}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0">
        <textarea
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          placeholder="Config will appear here after generation"
          className="h-full min-h-0 w-full overflow-auto rounded border border-gray-700 bg-gray-950 p-2 font-mono text-xs text-green-300"
        />
      </div>
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
          Export YAML
        </button>
      </div>
    </div>
  );
}

