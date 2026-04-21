import { GeneratedConfig, RequestDetail, NetworkRequest } from "@/types/network";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function navigate(url: string, sessionId = "default") {
  const res = await fetch(`${API_URL}/navigate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, session_id: sessionId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchRequests(sessionId = "default"): Promise<NetworkRequest[]> {
  const res = await fetch(`${API_URL}/requests?session_id=${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error(await res.text());
  const body = await res.json();
  return body.requests;
}

export async function fetchRequestDetail(requestId: string, sessionId = "default"): Promise<RequestDetail> {
  const res = await fetch(
    `${API_URL}/request/${encodeURIComponent(requestId)}?session_id=${encodeURIComponent(sessionId)}`,
  );
  if (!res.ok) throw new Error(await res.text());
  const body = await res.json();
  return body.request;
}

export async function generateConfig(requestId: string, sessionId = "default"): Promise<GeneratedConfig> {
  const res = await fetch(`${API_URL}/generate-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: requestId, session_id: sessionId }),
  });
  if (!res.ok) throw new Error(await res.text());
  const body = await res.json();
  return body.config;
}
export function proxyUrl(target: string) {
  return `${API_URL}/proxy?url=${encodeURIComponent(target)}`;
}

