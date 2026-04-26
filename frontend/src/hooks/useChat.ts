import { useState, useRef, useCallback, useEffect } from "react";
import type { MutableRefObject } from "react";
import { createWS } from "../lib/ws";
import { parseChatDirectives } from "../plugins/chatDirectives";
import type { ChatDirectiveHandler } from "../plugins/types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  args: string;
  preview: string;
  result?: string;
  duration?: number;
}

export interface SessionInfo {
  id: string;
  title: string;
  message_count: number;
  started_at: number;
}

export function useChat(chatDirectiveRef?: MutableRefObject<ChatDirectiveHandler | null>) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const wsRef = useRef<ReturnType<typeof createWS> | null>(null);
  const pendingRef = useRef<{ rawContent: string; content: string; tools: ToolCall[]; appliedDirectives: number }>({
    rawContent: "",
    content: "",
    tools: [],
    appliedDirectives: 0,
  });

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch("/api/chat/history");
      if (r.ok) {
        const history: ChatMessage[] = await r.json();
        setMessages(history.map((msg) => (
          msg.role === "assistant"
            ? { ...msg, content: parseChatDirectives(msg.content).text }
            : msg
        )));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const r = await fetch("/api/chat/sessions");
      if (r.ok) setSessions(await r.json());
    } catch {
      /* ignore */
    }
  }, []);

  // Load history + sessions on mount
  useEffect(() => {
    loadHistory();
    loadSessions();
  }, [loadHistory, loadSessions]);

  useEffect(() => {
    const ws = createWS(
      "/ws/chat",
      (data: unknown) => {
        const msg = data as Record<string, string | number>;
        const t = msg.type;

        if (t === "chunk") {
          pendingRef.current.rawContent += msg.content as string;
          const parsed = parseChatDirectives(pendingRef.current.rawContent);
          pendingRef.current.content = parsed.text;
          for (let i = pendingRef.current.appliedDirectives; i < parsed.directives.length; i++) {
            chatDirectiveRef?.current?.(parsed.directives[i]!);
          }
          pendingRef.current.appliedDirectives = parsed.directives.length;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  content: pendingRef.current.content,
                  toolCalls: [...pendingRef.current.tools],
                },
              ];
            }
            return [
              ...prev,
              {
                role: "assistant",
                content: pendingRef.current.content,
                toolCalls: [...pendingRef.current.tools],
              },
            ];
          });
        } else if (t === "tool_call") {
          pendingRef.current.tools.push({
            name: msg.name as string,
            args: msg.args as string,
            preview: msg.preview as string,
          });
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                { ...last, toolCalls: [...pendingRef.current.tools] },
              ];
            }
            return prev;
          });
        } else if (t === "tool_result") {
          const tools = pendingRef.current.tools;
          const idx = tools.findLastIndex(
            (tc: ToolCall) => tc.name === (msg.name as string),
          );
          if (idx >= 0) {
            const existing = tools[idx]!;
            tools[idx] = {
              name: existing.name,
              args: existing.args,
              preview: existing.preview,
              result: msg.result as string,
              duration: msg.duration as number,
            };
          }
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                { ...last, toolCalls: [...tools] },
              ];
            }
            return prev;
          });
        } else if (t === "done" || t === "error") {
          setStreaming(false);
        } else if (t === "interrupted") {
          setStreaming(false);
        } else if (t === "session_reset") {
          setMessages([]);
          setStreaming(false);
        }
      },
      () => setConnected(true),
      () => setConnected(false),
    );

    wsRef.current = ws;
    return () => ws.close();
  }, [chatDirectiveRef]);

  const send = useCallback((content: string) => {
    if (!content.trim()) return;
    pendingRef.current = { rawContent: "", content: "", tools: [], appliedDirectives: 0 };
    setMessages((prev) => [...prev, { role: "user", content }]);
    setStreaming(true);
    wsRef.current?.send({ type: "send", content });
  }, []);

  const interrupt = useCallback(() => {
    wsRef.current?.send({ type: "interrupt" });
  }, []);

  const newSession = useCallback(async () => {
    await fetch("/api/chat/sessions/new", { method: "POST" });
    setMessages([]);
    setStreaming(false);
    await loadSessions();
  }, [loadSessions]);

  const switchSession = useCallback(
    async (sessionId: string) => {
      const r = await fetch(`/api/chat/sessions/${sessionId}/switch`, {
        method: "POST",
      });
      if (r.ok) {
        await loadHistory();
        await loadSessions();
      }
    },
    [loadHistory, loadSessions],
  );

  return {
    messages,
    streaming,
    connected,
    sessions,
    send,
    interrupt,
    newSession,
    switchSession,
  };
}
