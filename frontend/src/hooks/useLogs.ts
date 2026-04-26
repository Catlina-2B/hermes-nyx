import { useState, useRef, useEffect } from "react";
import { createWS } from "../lib/ws";

export interface LogEntry {
  line: string;
  timestamp: string;
  level: string;
  session_id: string;
  message: string;
}

export interface LogSummary {
  title: string;
  status: "success" | "running" | "error";
  time: string;
}

export function useLogs() {
  const [rawLogs, setRawLogs] = useState<LogEntry[]>([]);
  const [summaries, setSummaries] = useState<LogSummary[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<ReturnType<typeof createWS> | null>(null);

  useEffect(() => {
    const ws = createWS(
      "/ws/logs",
      (data: unknown) => {
        const msg = data as Record<string, string>;
        if (msg.type === "raw_log") {
          setRawLogs((prev) => {
            const next = [
              ...prev,
              {
                line: msg.line ?? "",
                timestamp: msg.timestamp ?? "",
                level: msg.level ?? "",
                session_id: msg.session_id ?? "",
                message: msg.message ?? "",
              },
            ];
            return next.length > 500 ? next.slice(-300) : next;
          });
        } else if (msg.type === "summary") {
          setSummaries((prev) => [
            ...prev,
            {
              title: msg.title ?? "",
              status: (msg.status as LogSummary["status"]) ?? "running",
              time: msg.time ?? "",
            },
          ]);
        }
      },
      () => setConnected(true),
      () => setConnected(false),
    );

    wsRef.current = ws;
    return () => ws.close();
  }, []);

  return { rawLogs, summaries, connected };
}
