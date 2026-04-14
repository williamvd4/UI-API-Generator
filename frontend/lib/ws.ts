type WsHandler = (msg: unknown) => void;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

let socket: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

export function initWs(onMessage: WsHandler): () => void {
  let destroyed = false;
  let delay = 1000;

  function connect() {
    if (destroyed) return;
    const wsUrl = API_URL.replace("http", "ws") + "/ws";
    socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      delay = 1000;
      try {
        onMessage(JSON.parse(event.data));
      } catch {
        onMessage(event.data);
      }
    };

    socket.onclose = () => {
      if (destroyed) return;
      reconnectTimeout = setTimeout(() => {
        delay = Math.min(delay * 2, 30000);
        connect();
      }, delay);
    };

    socket.onerror = () => socket?.close();
  }

  connect();

  return () => {
    destroyed = true;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    socket?.close();
  };
}
