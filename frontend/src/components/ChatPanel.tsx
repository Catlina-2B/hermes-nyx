import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage, ToolCall, SessionInfo } from "../hooks/useChat";

interface Props {
  messages: ChatMessage[];
  streaming: boolean;
  sessions: SessionInfo[];
  onSend: (content: string) => void;
  onInterrupt: () => void;
  onNewSession: () => void;
  onSwitchSession: (id: string) => void;
}

function ToolCallItem({ tc }: { tc: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const done = tc.result !== undefined;

  return (
    <div
      className="border border-cyber-border rounded px-3 py-1.5 text-xs font-mono cursor-pointer hover:border-cyber-accent/30 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <span className={done ? "text-cyber-accent" : "text-cyber-warn animate-pulse"}>
          {done ? ">" : "~"}
        </span>
        <span className="text-cyber-text">{tc.preview || tc.name}</span>
        {done && tc.duration !== undefined && (
          <span className="text-cyber-muted ml-auto">{tc.duration}s</span>
        )}
      </div>
      {expanded && tc.result && (
        <pre className="mt-2 text-cyber-muted whitespace-pre-wrap break-all max-h-40 overflow-auto text-[11px]">
          {tc.result}
        </pre>
      )}
    </div>
  );
}

export default function ChatPanel({
  messages,
  streaming,
  sessions,
  onSend,
  onInterrupt,
  onNewSession,
  onSwitchSession,
}: Props) {
  const [input, setInput] = useState("");
  const [showSessions, setShowSessions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit() {
    if (streaming || !input.trim()) return;
    onSend(input.trim());
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-cyber-muted text-sm font-mono">
              // 输入消息开始对话
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "flex justify-end" : ""}>
            {msg.role === "user" ? (
              <div className="max-w-[80%] bg-cyber-accent/10 border border-cyber-accent/20 rounded-lg px-4 py-2 text-sm">
                {msg.content}
              </div>
            ) : (
              <div className="space-y-2">
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="space-y-1">
                    {msg.toolCalls.map((tc, j) => (
                      <ToolCallItem key={j} tc={tc} />
                    ))}
                  </div>
                )}
                {msg.content && (
                  <div className="prose prose-invert prose-sm max-w-none text-cyber-text text-sm [&_code]:bg-cyber-panel [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-cyber-accent [&_pre]:bg-cyber-panel [&_pre]:border [&_pre]:border-cyber-border [&_pre]:rounded-lg">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {streaming && (
          <div className="flex items-center gap-2 text-cyber-accent text-xs font-mono">
            <span className="animate-pulse">_</span>
            <span>思考中...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-cyber-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            rows={1}
            className="flex-1 bg-cyber-panel border border-cyber-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-cyber-accent/50 transition-colors placeholder:text-cyber-muted"
          />
          <div className="flex gap-1.5">
            {streaming ? (
              <button
                onClick={onInterrupt}
                className="px-3 py-2 bg-cyber-error/20 text-cyber-error border border-cyber-error/30 rounded-lg text-xs font-mono hover:bg-cyber-error/30 transition-colors"
              >
                STOP
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="px-3 py-2 bg-cyber-accent/20 text-cyber-accent border border-cyber-accent/30 rounded-lg text-xs font-mono hover:bg-cyber-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                SEND
              </button>
            )}
            <button
              onClick={onNewSession}
              title="新建会话"
              className="px-2 py-2 text-cyber-muted border border-cyber-border rounded-lg text-xs font-mono hover:text-cyber-accent hover:border-cyber-accent/30 transition-colors"
            >
              NEW
            </button>
            <div className="relative">
              <button
                onClick={() => setShowSessions(!showSessions)}
                title="会话列表"
                className="px-2 py-2 text-cyber-muted border border-cyber-border rounded-lg text-xs font-mono hover:text-cyber-text hover:border-cyber-text/30 transition-colors"
              >
                |||
              </button>
              {showSessions && sessions.length > 0 && (
                <div className="absolute bottom-full right-0 mb-1 w-56 bg-cyber-panel border border-cyber-border rounded-lg shadow-lg overflow-hidden z-50">
                  <div className="max-h-48 overflow-y-auto">
                    {sessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          onSwitchSession(s.id);
                          setShowSessions(false);
                        }}
                        className="w-full text-left px-3 py-2 text-[11px] font-mono text-cyber-text hover:bg-cyber-accent/10 border-b border-cyber-border/50 last:border-0 transition-colors"
                      >
                        <div className="truncate">{s.title}</div>
                        <div className="text-cyber-muted text-[9px]">
                          {s.message_count} msgs
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
