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

function rectStyle(r: Rect): React.CSSProperties {
  return {
    position: "absolute",
    left: r.x,
    top: r.y,
    width: r.w,
    height: r.h,
  };
}

export default function App() {
  const chatDirectiveRef = useRef<ChatDirectiveHandler | null>(null);
  const chat = useChat(chatDirectiveRef);
  const logs = useLogs();
  const { todos, add, toggle, remove } = useTodos();
  const effectsRef = useRef<DragEffectsHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

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

  // Default position: right side, vertically centered
  const defaultPos = useMemo(() => ({
    x: Math.max(0, window.innerWidth - AVATAR_W - 12),
    y: Math.max(0, (window.innerHeight - 40 - AVATAR_H) * 0.35),
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

  // Compute fluid layout from avatar position
  const layout = useMemo(
    () => containerSize.w > 0
      ? computeFluidLayout(
          { x: pos.x, y: pos.y, w: AVATAR_W, h: AVATAR_H },
          containerSize.w,
          containerSize.h,
        )
      : null,
    [pos.x, pos.y, containerSize.w, containerSize.h],
  );

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

        {/* Avatar panel — freely draggable */}
        <div
          ref={avatarRef}
          className="absolute z-30 overflow-hidden rounded-lg border border-cyber-border"
          style={{
            left: pos.x,
            top: pos.y,
            width: AVATAR_W,
            height: AVATAR_H,
          }}
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
