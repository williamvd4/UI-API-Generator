import { GeneratedConfig, RequestDetail, NetworkRequest } from "@/types/network";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

/** Returns auth header when an API key is configured; otherwise an empty object. */
function authHeaders(): Record<string, string> {
  return API_KEY ? { "X-Api-Key": API_KEY } : {};
}

export async function navigate(url: string, sessionId = "default") {
  const res = await fetch(`${API_URL}/navigate`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ url, session_id: sessionId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchRequests(sessionId = "default"): Promise<NetworkRequest[]> {
  const res = await fetch(`${API_URL}/requests?session_id=${encodeURIComponent(sessionId)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const body = await res.json();
  return body.requests;
}

export async function fetchRequestDetail(requestId: string, sessionId = "default"): Promise<RequestDetail> {
  const res = await fetch(
    `${API_URL}/request/${encodeURIComponent(requestId)}?session_id=${encodeURIComponent(sessionId)}`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error(await res.text());
  const body = await res.json();
  return body.request;
}

export async function generateConfig(requestId: string, sessionId = "default"): Promise<GeneratedConfig> {
  const res = await fetch(`${API_URL}/generate-config`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: requestId, session_id: sessionId }),
  });
  if (!res.ok) throw new Error(await res.text());
  const body = await res.json();
  return body.config;
}

export function screenshotUrl(sessionId = "default") {
  return `${API_URL}/screenshot?session_id=${encodeURIComponent(sessionId)}&ts=${Date.now()}`;
}

export async function interact(
  action: "click" | "type" | "scroll",
  x: number,
  y: number,
  sessionId = "default",
  text = "",
  deltaY = 0,
): Promise<{ status: string; current_url: string }> {
  const res = await fetch(`${API_URL}/interact`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, action, x, y, text, delta_y: deltaY }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function resetSession(sessionId = "default"): Promise<void> {
  const res = await fetch(
    `${API_URL}/reset-session?session_id=${encodeURIComponent(sessionId)}`,
    { method: "POST", headers: authHeaders() },
  );
  if (!res.ok) throw new Error(await res.text());
}
