import { useRef, useEffect, useState } from "react";
import type { LogEntry, LogSummary } from "../hooks/useLogs";

interface Props {
  rawLogs: LogEntry[];
  summaries: LogSummary[];
  connected: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  debug: "text-cyber-muted",
  info: "text-cyber-accent",
  warning: "text-cyber-warn",
  error: "text-cyber-error",
  critical: "text-cyber-error font-bold",
};

export default function LogPanel({ rawLogs, summaries, connected }: Props) {
  const [tab, setTab] = useState<"raw" | "summary">("raw");
  const [filter, setFilter] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rawLogs, summaries, autoScroll]);

  const filtered = filter
    ? rawLogs.filter(
        (l) =>
          l.message.toLowerCase().includes(filter.toLowerCase()) ||
          l.level.includes(filter.toLowerCase()),
      )
    : rawLogs;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-cyber-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-cyber-muted">LOG</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-cyber-accent" : "bg-cyber-error"}`}
          />
        </div>
        <div className="flex gap-1">
          {(["raw", "summary"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                tab === t
                  ? "bg-cyber-accent/20 text-cyber-accent"
                  : "text-cyber-muted hover:text-cyber-text"
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Filter */}
      {tab === "raw" && (
        <div className="shrink-0 px-3 py-1.5 border-b border-cyber-border">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter..."
            className="w-full bg-transparent text-[11px] font-mono text-cyber-text placeholder:text-cyber-muted/50 focus:outline-none"
          />
        </div>
      )}

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto px-3 py-2 text-[11px] font-mono space-y-0.5"
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < 50;
          setAutoScroll(atBottom);
        }}
      >
        {tab === "raw" ? (
          filtered.length === 0 ? (
            <p className="text-cyber-muted text-center mt-8">
              等待日志...
            </p>
          ) : (
            filtered.map((log, i) => (
              <div key={i} className="flex gap-2 leading-relaxed">
                <span className="text-cyber-muted/60 shrink-0">
                  {log.timestamp.slice(11)}
                </span>
                <span
                  className={`shrink-0 w-12 text-right ${LEVEL_COLORS[log.level] || "text-cyber-text"}`}
                >
                  {log.level.toUpperCase()}
                </span>
                <span className="text-cyber-text break-all">{log.message}</span>
              </div>
            ))
          )
        ) : summaries.length === 0 ? (
          <p className="text-cyber-muted text-center mt-8">
            等待摘要...
          </p>
        ) : (
          summaries.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-2 py-1 border-b border-cyber-border/50"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  s.status === "success"
                    ? "bg-cyber-accent"
                    : s.status === "running"
                      ? "bg-cyber-warn animate-pulse"
                      : "bg-cyber-error"
                }`}
              />
              <span className="text-cyber-text">{s.title}</span>
              <span className="text-cyber-muted ml-auto">{s.time}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
