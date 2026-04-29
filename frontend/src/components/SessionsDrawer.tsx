import { useState, useMemo, useEffect, useRef } from "react";
import type { SessionInfo } from "../hooks/useChat";

interface Props {
  open: boolean;
  sessions: SessionInfo[];
  currentSessionId: string | null;
  onClose: () => void;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

type Bucket = "today" | "yesterday" | "week" | "older";

const BUCKET_LABEL: Record<Bucket, string> = {
  today: "今天",
  yesterday: "昨天",
  week: "本周",
  older: "更早",
};

function bucketOf(ts: number, now: Date): Bucket {
  const d = new Date(ts * 1000);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  if (d >= startOfToday) return "today";
  if (d >= startOfYesterday) return "yesterday";
  if (d >= startOfWeek) return "week";
  return "older";
}

function formatRelative(ts: number, now: Date): string {
  const d = new Date(ts * 1000);
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return "刚刚";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;

  const sameDay = d.toDateString() === now.toDateString();
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hh}:${mm}`;

  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${m}-${dd} ${hh}:${mm}`;
}

export default function SessionsDrawer({
  open,
  sessions,
  currentSessionId,
  onClose,
  onSwitch,
  onNew,
  onRename,
  onDelete,
}: Props) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // ESC closes drawer (or cancels in-progress edit/delete)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (editingId) {
        setEditingId(null);
        return;
      }
      if (pendingDelete) {
        setPendingDelete(null);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editingId, pendingDelete, onClose]);

  // Focus the edit input whenever an edit starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const now = useMemo(() => new Date(), [open, sessions]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups: Record<Bucket, SessionInfo[]> = {
      today: [],
      yesterday: [],
      week: [],
      older: [],
    };
    for (const s of sessions) {
      if (q && !s.title.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) continue;
      groups[bucketOf(s.last_active, now)].push(s);
    }
    return groups;
  }, [sessions, query, now]);

  const totalShown =
    grouped.today.length + grouped.yesterday.length + grouped.week.length + grouped.older.length;

  function commitRename() {
    if (!editingId) return;
    const title = editValue.trim();
    const id = editingId;
    setEditingId(null);
    onRename(id, title);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-[320px] bg-[#0a0e17] border-r border-cyan-400/15 shadow-[0_0_40px_rgba(34,211,238,0.12)] flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header — leaves room for macOS traffic lights at top-left */}
        <div className="shrink-0 flex items-center justify-between pl-20 pr-3 h-12 border-b border-cyber-border">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-cyan-300 text-xs font-mono tracking-[0.2em] glow-text whitespace-nowrap">
              历史会话
            </span>
            <span className="text-cyber-muted text-[10px] font-mono">{sessions.length}</span>
          </div>
          <button
            onClick={onClose}
            title="关闭 (Esc)"
            className="text-cyber-muted hover:text-cyber-text text-sm font-mono w-6 h-6 flex items-center justify-center rounded hover:bg-cyber-border/50 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* New + search */}
        <div className="shrink-0 px-3 pt-3 pb-2 space-y-2">
          <button
            onClick={() => {
              onNew();
              onClose();
            }}
            className="w-full px-3 py-2 bg-cyber-accent/15 border border-cyber-accent/30 rounded-lg text-xs font-mono text-cyber-accent hover:bg-cyber-accent/25 transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-base leading-none">+</span>
            <span>新建会话</span>
          </button>
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索标题或 ID..."
              className="w-full bg-cyber-panel border border-cyber-border rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono text-cyber-text placeholder:text-cyber-muted/60 focus:outline-none focus:border-cyber-accent/40"
            />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-cyber-muted text-[10px]">⌕</span>
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-cyber-muted hover:text-cyber-text text-[10px]"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {totalShown === 0 && (
            <div className="text-center text-cyber-muted text-[11px] font-mono py-8">
              {query ? "没有匹配的会话" : "暂无历史会话"}
            </div>
          )}
          {(["today", "yesterday", "week", "older"] as Bucket[]).map((b) => {
            const items = grouped[b];
            if (items.length === 0) return null;
            return (
              <div key={b} className="mt-2">
                <div className="px-2 py-1 text-[10px] font-mono text-cyber-muted uppercase tracking-widest">
                  {BUCKET_LABEL[b]}
                </div>
                <div className="space-y-1">
                  {items.map((s) => {
                    const isCurrent = s.id === currentSessionId;
                    const isEditing = editingId === s.id;
                    const isPendingDelete = pendingDelete === s.id;
                    return (
                      <div
                        key={s.id}
                        className={`group relative rounded-lg border transition-colors ${
                          isCurrent
                            ? "border-cyber-accent/50 bg-cyber-accent/5"
                            : "border-transparent hover:border-cyber-border hover:bg-cyber-panel/60"
                        }`}
                      >
                        <button
                          onClick={() => {
                            if (isEditing || isPendingDelete) return;
                            if (!isCurrent) onSwitch(s.id);
                            onClose();
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingId(s.id);
                            setEditValue(s.has_custom_title ? s.title : "");
                          }}
                          className="w-full text-left px-3 py-2 pr-14"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isCurrent && (
                              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyber-accent shadow-[0_0_6px_rgba(34,211,238,0.7)]" />
                            )}
                            {isEditing ? (
                              <input
                                ref={editInputRef}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === "Enter") commitRename();
                                  else if (e.key === "Escape") setEditingId(null);
                                }}
                                onBlur={commitRename}
                                placeholder="留空恢复默认标题"
                                className="flex-1 bg-cyber-bg border border-cyber-accent/40 rounded px-1.5 py-0.5 text-[12px] font-mono text-cyber-text outline-none"
                              />
                            ) : (
                              <span
                                className={`truncate text-[12px] font-mono ${
                                  isCurrent ? "text-cyber-accent" : "text-cyber-text"
                                }`}
                              >
                                {s.title}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 pl-3.5 flex items-center gap-2 text-[10px] font-mono text-cyber-muted">
                            <span>{formatRelative(s.last_active, now)}</span>
                            <span className="text-cyber-muted/50">·</span>
                            <span>{s.message_count} msgs</span>
                          </div>
                        </button>

                        {/* Action buttons: rename / delete */}
                        {!isEditing && !isPendingDelete && (
                          <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              title="重命名 (双击亦可)"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(s.id);
                                setEditValue(s.has_custom_title ? s.title : "");
                              }}
                              className="w-6 h-6 flex items-center justify-center text-cyber-muted hover:text-cyber-accent hover:bg-cyber-accent/10 rounded text-[11px]"
                            >
                              ✎
                            </button>
                            <button
                              title="删除"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete(s.id);
                              }}
                              className="w-6 h-6 flex items-center justify-center text-cyber-muted hover:text-cyber-error hover:bg-cyber-error/10 rounded text-[11px]"
                            >
                              🗑
                            </button>
                          </div>
                        )}

                        {/* Delete confirmation overlay */}
                        {isPendingDelete && (
                          <div className="absolute inset-0 flex items-center justify-end gap-1 pr-2 bg-[#0a0e17]/90 rounded-lg">
                            <span className="text-[11px] font-mono text-cyber-muted mr-auto pl-3">
                              删除此会话？
                            </span>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const id = s.id;
                                setPendingDelete(null);
                                await onDelete(id);
                              }}
                              className="px-2 py-1 text-[10px] font-mono text-cyber-error border border-cyber-error/40 rounded hover:bg-cyber-error/15"
                            >
                              删除
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete(null);
                              }}
                              className="px-2 py-1 text-[10px] font-mono text-cyber-muted border border-cyber-border rounded hover:text-cyber-text"
                            >
                              取消
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

      </aside>
    </>
  );
}
