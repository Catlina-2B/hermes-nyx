import { useState, useRef, useEffect, useCallback } from "react";

const BACKEND_URL = "http://localhost:8081";

interface ChatResponse {
  role: string;
  content: string;
}

export default function SpotlightApp() {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount and when window becomes visible
  useEffect(() => {
    inputRef.current?.focus();

    const onFocus = () => {
      setInput("");
      setReply("");
      setExpanded(false);
      inputRef.current?.focus();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // ESC to hide
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        (window as any).hermesDesktop?.hideSpotlight?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setLoading(true);
    setExpanded(true);
    setReply("");

    // Notify main process to resize window
    (window as any).hermesDesktop?.spotlightExpand?.();

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/quick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Stream response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullReply = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Parse SSE-style chunks
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "chunk" && data.content) {
                  fullReply += data.content;
                  setReply(fullReply);
                }
              } catch { /* skip non-JSON lines */ }
            }
          }
        }
      }

      if (!fullReply) {
        // Fallback: try to read as JSON
        const data = await res.json().catch(() => null);
        if (data?.content) setReply(data.content);
      }
    } catch (err) {
      setReply(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="w-full p-2">
      {/* Input bar */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#0d1220]/95 border border-cyan-400/20 backdrop-blur-xl shadow-[0_0_40px_rgba(34,211,238,0.12)]">
        {/* Hermes icon */}
        <div className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center">
          <span className="text-[10px] font-bold text-cyber-bg">H</span>
        </div>

        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask Hermes anything..."
          className="flex-1 bg-transparent text-sm font-mono text-cyber-text placeholder:text-cyber-muted outline-none"
          disabled={loading}
        />

        {loading && (
          <div className="shrink-0 w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
        )}
      </div>

      {/* Reply area */}
      {expanded && reply && (
        <div className="mt-2 px-4 py-3 rounded-2xl bg-[#0d1220]/95 border border-cyan-400/10 backdrop-blur-xl max-h-[300px] overflow-y-auto">
          <p className="text-xs font-mono text-cyber-text leading-relaxed whitespace-pre-wrap">{reply}</p>
        </div>
      )}
    </div>
  );
}
