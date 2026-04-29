import { useState, useRef, useCallback, useEffect } from "react";
import type { MutableRefObject } from "react";
import { createWS } from "../lib/ws";
import { parseChatDirectives } from "../plugins/chatDirectives";
import type { ChatDirectiveHandler } from "../plugins/types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[]; // base64 encoded images (user messages only)
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
  has_custom_title: boolean;
  message_count: number;
  started_at: number;
  last_active: number;
  is_current: boolean;
}

export function useChat(chatDirectiveRef?: MutableRefObject<ChatDirectiveHandler | null>) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
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
      if (r.ok) {
        const list: SessionInfo[] = await r.json();
        setSessions(list);
        const cur = list.find((s) => s.is_current);
        if (cur) setCurrentSessionId(cur.id);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadCurrentSession = useCallback(async () => {
    try {
      const r = await fetch("/api/chat/sessions/current");
      if (r.ok) {
        const data = await r.json();
        if (data?.session_id) setCurrentSessionId(data.session_id);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Load history + sessions on mount
  useEffect(() => {
    loadHistory();
    loadSessions();
    loadCurrentSession();
  }, [loadHistory, loadSessions, loadCurrentSession]);

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
        } else if (t === "done") {
          setStreaming(false);
          if (msg.session_id) setCurrentSessionId(msg.session_id as string);
        } else if (t === "error") {
          setStreaming(false);
        } else if (t === "interrupted") {
          setStreaming(false);
        } else if (t === "session_reset") {
          setMessages([]);
          setStreaming(false);
          if (msg.session_id) setCurrentSessionId(msg.session_id as string);
        }
      },
      () => setConnected(true),
      () => setConnected(false),
    );

    wsRef.current = ws;
    return () => ws.close();
  }, [chatDirectiveRef]);

  const send = useCallback((content: string, images?: string[]) => {
    if (!content.trim() && (!images || images.length === 0)) return;
    pendingRef.current = { rawContent: "", content: "", tools: [], appliedDirectives: 0 };
    setMessages((prev) => [...prev, { role: "user", content, images }]);
    setStreaming(true);
    chatDirectiveRef?.current?.({ animation: "thinking" });
    const payload: Record<string, unknown> = { type: "send", content };
    if (images && images.length > 0) {
      payload.images = images;
    }
    wsRef.current?.send(payload);
  }, [chatDirectiveRef]);

  const interrupt = useCallback(() => {
    wsRef.current?.send({ type: "interrupt" });
  }, []);

  const newSession = useCallback(async () => {
    const r = await fetch("/api/chat/sessions/new", { method: "POST" });
    setMessages([]);
    setStreaming(false);
    if (r.ok) {
      try {
        const data = await r.json();
        if (data?.session_id) setCurrentSessionId(data.session_id);
      } catch { /* ignore */ }
    }
    await loadSessions();
  }, [loadSessions]);

  const switchSession = useCallback(
    async (sessionId: string) => {
      const r = await fetch(`/api/chat/sessions/${sessionId}/switch`, {
        method: "POST",
      });
      if (r.ok) {
        setCurrentSessionId(sessionId);
        await loadHistory();
        await loadSessions();
      }
    },
    [loadHistory, loadSessions],
  );

  const renameSession = useCallback(
    async (sessionId: string, title: string) => {
      const r = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (r.ok) await loadSessions();
      return r.ok;
    },
    [loadSessions],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      const r = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!r.ok) return false;
      // If deleted current, clear local view
      if (sessionId === currentSessionId) {
        setMessages([]);
        setCurrentSessionId(null);
      }
      await loadSessions();
      return true;
    },
    [currentSessionId, loadSessions],
  );

  return {
    messages,
    streaming,
    connected,
    sessions,
    currentSessionId,
    send,
    interrupt,
    newSession,
    switchSession,
    renameSession,
    deleteSession,
    refreshSessions: loadSessions,
  };
}
