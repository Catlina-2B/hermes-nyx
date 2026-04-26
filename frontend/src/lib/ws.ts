type MessageHandler = (data: unknown) => void;

export function createWS(
  path: string,
  onMessage: MessageHandler,
  onOpen?: () => void,
  onClose?: () => void,
): { send: (data: unknown) => void; close: () => void } {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${location.host}${path}`;
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  function connect() {
    if (closed) return;
    ws = new WebSocket(url);

    ws.onopen = () => onOpen?.();

    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch {
        /* ignore parse errors */
      }
    };

    ws.onclose = () => {
      onClose?.();
      if (!closed) {
        reconnectTimer = setTimeout(connect, 2000);
      }
    };

    ws.onerror = () => ws?.close();
  }

  connect();

  return {
    send(data: unknown) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    },
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
