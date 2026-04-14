type WsHandler = (msg: unknown) => void;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

let socket: WebSocket | null = null;

export function initWs(onMessage: WsHandler): () => void {
  const wsUrl = API_URL.replace("http", "ws") + "/ws";
  socket = new WebSocket(wsUrl);
  socket.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      onMessage(event.data);
    }
  };

  return () => socket?.close();
}
