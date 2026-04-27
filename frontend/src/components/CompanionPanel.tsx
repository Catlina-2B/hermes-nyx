import { useState, useEffect, useRef } from "react";

interface AnalysisEntry {
  timestamp: string;
  activity: string;
  should_speak: boolean;
  message: string;
  mood: string;
  todos?: string[];
  skill_used?: string;
}

const MOOD_EMOJI: Record<string, string> = {
  happy: "😊",
  curious: "🤔",
  concerned: "😟",
  neutral: "😐",
};

const SKILL_LABEL: Record<string, string> = {
  code_review: "🔍 代码",
  security: "🛡️ 安全",
  todo: "📋 待办",
  efficiency: "⚡ 效率",
  health: "💚 健康",
  chat: "💬 闲聊",
};

export default function CompanionPanel() {
  const [history, setHistory] = useState<AnalysisEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Poll history every 3 seconds
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/companion/history");
        if (res.ok) setHistory(await res.json());
      } catch { /* ignore */ }
    };
    fetch_();
    const timer = setInterval(fetch_, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-cyber-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-cyber-accent font-semibold">COMPANION</span>
          <span className="text-[10px] text-cyber-muted">{history.length} analyses</span>
        </div>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {history.length === 0 && (
          <div className="text-center text-xs text-cyber-muted py-4 font-mono">
            // 暂无观察记录
            <br />
            <span className="text-[10px]">⌘⇧S 立即分析</span>
          </div>
        )}
        {history.map((entry, i) => (
          <div
            key={i}
            className={`rounded-lg border px-3 py-2 text-xs font-mono space-y-1 ${
              entry.should_speak
                ? "border-cyan-400/20 bg-cyan-950/20"
                : "border-cyber-border bg-cyber-panel/50"
            }`}
          >
            {/* Time + skill + mood */}
            <div className="flex items-center justify-between text-[10px] text-cyber-muted">
              <span>{entry.timestamp} {SKILL_LABEL[entry.skill_used || ""] || ""}</span>
              <span>{MOOD_EMOJI[entry.mood] || "😐"}</span>
            </div>

            {/* Activity */}
            <p className="text-cyber-text/70">{entry.activity}</p>

            {/* Message (if AI spoke) */}
            {entry.should_speak && entry.message && (
              <p className="text-cyber-accent border-l-2 border-cyan-400/30 pl-2 mt-1">
                {entry.message}
              </p>
            )}

            {/* Todos created */}
            {entry.todos && entry.todos.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {entry.todos.map((t, j) => (
                  <p key={j} className="text-[10px] text-cyber-warn">📋 {t}</p>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
