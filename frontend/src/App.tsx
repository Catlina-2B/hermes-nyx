import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { useChat } from "./hooks/useChat";
import { useLogs } from "./hooks/useLogs";
import { useTodos } from "./hooks/useTodos";
import { useFreeDrag } from "./hooks/useFreeDrag";
import { computeFluidLayout, type Rect } from "./lib/fluid-layout";
import SystemBar from "./components/SystemBar";
import ChatPanel from "./components/ChatPanel";
import LogPanel from "./components/LogPanel";
import TodoPanel from "./components/TodoPanel";
import DragEffectsCanvas, { type DragEffectsHandle } from "./components/DragEffectsCanvas";
import DigitalHumanPanel from "./plugins/vrm-digital-human/DigitalHumanPanel";
import { frontendPlugins } from "./plugins/registry";
import type { ChatDirectiveHandler } from "./plugins/types";

const AVATAR_W = 320;
const AVATAR_H = 420;

type AvatarLocation = "desktop" | "webui";

function rectStyle(r: Rect): React.CSSProperties {
  return {
    position: "absolute",
    left: r.x,
    top: r.y,
    width: r.w,
    height: r.h,
  };
}

/** Check if running inside Electron */
function isElectron(): boolean {
  return !!(window as any).hermesDesktop;
}

export default function App() {
  const chatDirectiveRef = useRef<ChatDirectiveHandler | null>(null);
  const chat = useChat(chatDirectiveRef);
  const logs = useLogs();
  const { todos, add, toggle, remove } = useTodos();
  const effectsRef = useRef<DragEffectsHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  // Avatar location: "desktop" (companion window) or "webui" (inline)
  // Persisted to localStorage so it survives page refresh
  const [avatarLocation, setAvatarLocation] = useState<AvatarLocation>(() => {
    try {
      const saved = localStorage.getItem("hermes-avatar-location");
      if (saved === "desktop" || saved === "webui") return saved;
    } catch { /* noop */ }
    return isElectron() ? "desktop" : "webui";
  });

  // Persist and sync with Electron on change
  useEffect(() => {
    try { localStorage.setItem("hermes-avatar-location", avatarLocation); } catch { /* noop */ }
    // Tell Electron to show/hide companion window
    if (isElectron()) {
      (window as any).hermesDesktop?.switchAvatarTo?.(avatarLocation);
    }
  }, [avatarLocation]);

  // Listen for avatar switch events from Electron
  useEffect(() => {
    const hd = (window as any).hermesDesktop;
    if (!hd?.onAvatarSwitch) return;
    hd.onAvatarSwitch((location: AvatarLocation) => {
      setAvatarLocation(location);
    });
  }, []);

  const showAvatarInWebUI = avatarLocation === "webui";

  // Right-click context menu for switching avatar location
  const onAvatarContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!isElectron()) return;
    const target = avatarLocation === "webui" ? "desktop" : "webui";
    const label = target === "desktop" ? "移至桌面悬浮" : "移至客户端内";
    // Simple native-like context menu using a temporary div
    const menu = document.createElement("div");
    menu.className = "fixed z-[9999] py-1 px-0 rounded-lg border border-cyan-400/20 bg-[#0d1220]/95 backdrop-blur-xl shadow-[0_0_30px_rgba(34,211,238,0.12)] min-w-[140px]";
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    const item = document.createElement("button");
    item.textContent = label;
    item.className = "block w-full text-left px-4 py-2 text-xs font-mono text-cyan-200 hover:bg-cyan-400/10 transition-colors";
    item.onclick = () => {
      (window as any).hermesDesktop?.switchAvatarTo?.(target);
      setAvatarLocation(target);
      document.body.removeChild(menu);
    };
    menu.appendChild(item);

    const dismiss = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        if (document.body.contains(menu)) document.body.removeChild(menu);
        document.removeEventListener("mousedown", dismiss);
      }
    };
    document.addEventListener("mousedown", dismiss);
    document.body.appendChild(menu);
  }, [avatarLocation]);

  // Container size tracking
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Default position: right side
  const defaultPos = useMemo(() => ({
    x: Math.max(0, window.innerWidth - AVATAR_W - 12),
    y: Math.max(0, (window.innerHeight - 48 - AVATAR_H) * 0.35),
  }), []);

  const getAvatarRect = useCallback((): DOMRect | null => {
    return avatarRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const dragCallbacks = useMemo(() => ({
    onDragStart: (mx: number, my: number) =>
      effectsRef.current?.onDragEvent({ type: "start", mouseX: mx, mouseY: my, panelRect: getAvatarRect() }),
    onDragMove: (mx: number, my: number) =>
      effectsRef.current?.onDragEvent({ type: "move", mouseX: mx, mouseY: my, panelRect: getAvatarRect() }),
    onDragEnd: (mx: number, my: number) =>
      effectsRef.current?.onDragEvent({ type: "stop", mouseX: mx, mouseY: my, panelRect: getAvatarRect() }),
  }), [getAvatarRect]);

  const { pos, dragging, onPointerDown } = useFreeDrag(
    containerRef,
    { w: AVATAR_W, h: AVATAR_H },
    dragCallbacks,
    defaultPos,
  );

  // Compute fluid layout — responsive to container size
  const layout = useMemo(() => {
    const cw = containerSize.w;
    const ch = containerSize.h;
    if (cw <= 0) return null;
    const g = 6; // gap

    if (!showAvatarInWebUI) {
      // No avatar — responsive layout for chat + log + todo
      if (cw < 640) {
        // Narrow: stack vertically (chat top, log+todo bottom)
        const chatH = ch * 0.6;
        const sideH = ch - chatH - g;
        return {
          chat: { x: 0, y: 0, w: cw, h: chatH },
          log:  { x: 0, y: chatH + g, w: cw * 0.6 - g / 2, h: sideH },
          todo: { x: cw * 0.6 + g / 2, y: chatH + g, w: cw * 0.4 - g / 2, h: sideH },
        };
      }
      // Normal: chat left, sidebar right (proportional width)
      const sideW = Math.min(320, Math.max(200, cw * 0.25));
      const chatW = cw - sideW - g;
      return {
        chat: { x: 0, y: 0, w: chatW, h: ch },
        log:  { x: chatW + g, y: 0, w: sideW, h: ch * 0.65 },
        todo: { x: chatW + g, y: ch * 0.65 + g, w: sideW, h: ch * 0.35 - g },
      };
    }

    // Avatar in webui — fluid layout
    return computeFluidLayout(
      { x: pos.x, y: pos.y, w: AVATAR_W, h: AVATAR_H },
      cw,
      ch,
    );
  }, [pos.x, pos.y, containerSize.w, containerSize.h, showAvatarInWebUI]);

  const panelTransition = dragging
    ? "left 0.05s linear, top 0.05s linear, width 0.05s linear, height 0.05s linear"
    : "left 0.35s cubic-bezier(0.2,0,0,1), top 0.35s cubic-bezier(0.2,0,0,1), width 0.35s cubic-bezier(0.2,0,0,1), height 0.35s cubic-bezier(0.2,0,0,1)";

  return (
    <div className="h-screen flex flex-col bg-cyber-bg">
      <SystemBar chatConnected={chat.connected} />

      {/* Fluid layout container */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {layout && (
          <>
            {/* Chat panel */}
            <div
              className="absolute overflow-hidden rounded-lg border border-cyber-border bg-cyber-panel"
              style={{ ...rectStyle(layout.chat), transition: panelTransition }}
            >
              <ChatPanel
                messages={chat.messages}
                streaming={chat.streaming}
                sessions={chat.sessions}
                onSend={chat.send}
                onInterrupt={chat.interrupt}
                onNewSession={chat.newSession}
                onSwitchSession={chat.switchSession}
              />
            </div>

            {/* Log panel */}
            <div
              className="absolute overflow-hidden rounded-lg border border-cyber-border bg-cyber-panel"
              style={{ ...rectStyle(layout.log), transition: panelTransition }}
            >
              <LogPanel
                rawLogs={logs.rawLogs}
                summaries={logs.summaries}
                connected={logs.connected}
              />
            </div>

            {/* Todo panel */}
            <div
              className="absolute overflow-hidden rounded-lg border border-cyber-border bg-cyber-panel"
              style={{ ...rectStyle(layout.todo), transition: panelTransition }}
            >
              <TodoPanel
                todos={todos}
                onAdd={add}
                onToggle={toggle}
                onRemove={remove}
              />
            </div>
          </>
        )}

        {/* Avatar panel — only shown when in webui mode */}
        {showAvatarInWebUI && (
          <div
            ref={avatarRef}
            className="absolute z-30 overflow-hidden rounded-lg border border-cyber-border"
            style={{
              left: pos.x,
              top: pos.y,
              width: AVATAR_W,
              height: AVATAR_H,
            }}
            onContextMenu={onAvatarContextMenu}
          >
            {/* Drag handle */}
            <div
              onPointerDown={onPointerDown}
              className="absolute inset-x-0 top-0 z-40 h-9 cursor-grab active:cursor-grabbing group select-none touch-none"
            >
              <div className="absolute left-1/2 -translate-x-1/2 top-3 flex items-center gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className="block w-[3px] h-[3px] rounded-full bg-cyan-300/60" />
                ))}
              </div>
            </div>
            <DigitalHumanPanel expressionCallbackRef={chatDirectiveRef} />
          </div>
        )}
      </div>

      {/* Plugin overlays */}
      {frontendPlugins.map((plugin) =>
        plugin.renderOverlay ? (
          <div key={plugin.id}>{plugin.renderOverlay({ chatDirectiveRef })}</div>
        ) : null,
      )}

      <DragEffectsCanvas ref={effectsRef} />
    </div>
  );
}
