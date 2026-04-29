import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage, ToolCall, SessionInfo } from "../hooks/useChat";
import SessionsDrawer from "./SessionsDrawer";

interface Props {
  messages: ChatMessage[];
  streaming: boolean;
  sessions: SessionInfo[];
  currentSessionId: string | null;
  onSend: (content: string, images?: string[]) => void;
  onInterrupt: () => void;
  onNewSession: () => void;
  onSwitchSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => Promise<boolean>;
  onDeleteSession: (id: string) => Promise<boolean>;
  onOpenSessions: () => void;
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
  currentSessionId,
  onSend,
  onInterrupt,
  onNewSession,
  onSwitchSession,
  onRenameSession,
  onDeleteSession,
  onOpenSessions,
}: Props) {
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function openSessions() {
    onOpenSessions();
    setShowSessions(true);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit() {
    if (streaming || (!input.trim() && images.length === 0)) return;
    onSend(input.trim(), images.length > 0 ? images : undefined);
    setInput("");
    setImages([]);
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

  const addImageFromFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      if (base64) setImages((prev) => [...prev, base64]);
    };
    reader.readAsDataURL(file);
  }, []);

  // Paste image from clipboard
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) addImageFromFile(file);
        }
      }
    };
    el.addEventListener("paste", onPaste);
    return () => el.removeEventListener("paste", onPaste);
  }, [addImageFromFile]);

  // Drop image
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    for (const file of e.dataTransfer.files) {
      addImageFromFile(file);
    }
  }, [addImageFromFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

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
                {msg.images && msg.images.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {msg.images.map((img, idx) => (
                      <img key={idx} src={`data:image/png;base64,${img}`} alt="" className="max-h-32 rounded-md border border-cyber-border" />
                    ))}
                  </div>
                )}
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
                  <div className="prose prose-invert prose-sm max-w-none text-cyber-text text-sm prose-p:leading-relaxed prose-p:my-1.5 prose-headings:text-cyber-accent prose-headings:font-mono prose-headings:mt-4 prose-headings:mb-2 prose-strong:text-white prose-strong:font-semibold prose-em:text-cyan-300 prose-a:text-cyber-accent prose-a:no-underline hover:prose-a:underline prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-li:marker:text-cyber-accent/60 prose-blockquote:border-cyber-accent/30 prose-blockquote:text-cyber-muted prose-blockquote:not-italic prose-blockquote:my-2 prose-hr:border-cyber-border prose-code:bg-cyber-panel prose-code:text-cyber-accent prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#0a0e17] prose-pre:border prose-pre:border-cyber-border prose-pre:rounded-lg prose-pre:my-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-cyber-text">
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
      <div className="shrink-0 border-t border-cyber-border p-3" onDrop={onDrop} onDragOver={onDragOver}>
        {/* Image preview */}
        {images.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {images.map((img, idx) => (
              <div key={idx} className="relative group">
                <img src={`data:image/png;base64,${img}`} alt="" className="h-16 rounded-md border border-cyber-border" />
                <button
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-cyber-error text-white text-[9px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            for (const f of e.target.files || []) addImageFromFile(f);
            e.target.value = "";
          }}
        />
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            title="添加图片 (也可粘贴或拖拽)"
            className="shrink-0 px-2 py-2 text-cyber-muted border border-cyber-border rounded-lg text-sm hover:text-cyber-accent hover:border-cyber-accent/30 transition-colors"
          >
            +
          </button>
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
            <button
              onClick={openSessions}
              title="历史会话"
              aria-label="历史会话"
              className="relative px-2 py-2 text-cyber-muted border border-cyber-border rounded-lg hover:text-cyber-text hover:border-cyber-text/30 transition-colors flex items-center gap-1.5"
            >
              {/* History icon (clock + arrow) drawn with svg */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <polyline points="3 3 3 8 8 8" />
                <polyline points="12 7 12 12 15 14" />
              </svg>
              {sessions.length > 0 && (
                <span className="text-[10px] font-mono leading-none text-cyber-muted/80">
                  {sessions.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <SessionsDrawer
        open={showSessions}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onClose={() => setShowSessions(false)}
        onSwitch={onSwitchSession}
        onNew={onNewSession}
        onRename={onRenameSession}
        onDelete={onDeleteSession}
      />
    </div>
  );
}
