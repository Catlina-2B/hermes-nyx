import { useRef, useState, useEffect, useCallback } from "react";
import DigitalHumanPanel from "../plugins/vrm-digital-human/DigitalHumanPanel";
import type { ChatDirectiveHandler } from "../plugins/types";

interface BubbleMessage {
  text: string;
  id: number;
}

let msgId = 0;

export default function CompanionApp() {
  const chatDirectiveRef = useRef<ChatDirectiveHandler | null>(null);
  const [bubble, setBubble] = useState<BubbleMessage | null>(null);

  // Override global.css body background for transparent window
  useEffect(() => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
  }, []);

  // Listen for companion messages from Electron main process
  useEffect(() => {
    const hermesDesktop = (window as any).hermesDesktop;
    if (!hermesDesktop?.onCompanionMessage) return;

    hermesDesktop.onCompanionMessage((data: { text?: string; directive?: Record<string, unknown> }) => {
      if (data.directive && chatDirectiveRef.current) {
        chatDirectiveRef.current(data.directive);
      }
      if (data.text) {
        const id = ++msgId;
        setBubble({ text: data.text, id });
      }
    });
  }, []);

  // Auto-hide bubble after 6 seconds
  useEffect(() => {
    if (!bubble) return;
    const timer = setTimeout(() => setBubble(null), 6000);
    return () => clearTimeout(timer);
  }, [bubble?.id]);

  // Window dragging via IPC
  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.screenX;
    const startY = e.screenY;
    const ipc = (window as any).hermesDesktop;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.screenX - startX;
      const dy = ev.screenY - startY;
      ipc?.moveCompanionWindow?.(dx, dy);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      ipc?.moveCompanionWindowEnd?.();
    };

    ipc?.moveCompanionWindowStart?.();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  // Right-click to switch avatar to webui
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const hd = (window as any).hermesDesktop;
    if (!hd?.switchAvatarTo) return;

    const menu = document.createElement("div");
    menu.className = "fixed z-[9999] py-1 rounded-lg border border-cyan-400/20 bg-[#0d1220]/95 backdrop-blur-xl shadow-[0_0_30px_rgba(34,211,238,0.12)] min-w-[140px]";
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    const item = document.createElement("button");
    item.textContent = "移至客户端内";
    item.className = "block w-full text-left px-4 py-2 text-xs font-mono text-cyan-200 hover:bg-cyan-400/10 transition-colors";
    item.onclick = () => {
      hd.switchAvatarTo("webui");
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
  }, []);

  return (
    <div className="relative w-full h-full select-none">
      {/* Drag handle — entire window is draggable + right-click menu */}
      <div
        onPointerDown={onDragStart}
        onContextMenu={onContextMenu}
        className="absolute inset-0 z-40 cursor-grab active:cursor-grabbing"
      />

      {/* VRM Character */}
      <div className="absolute inset-0 z-10">
        <DigitalHumanPanel expressionCallbackRef={chatDirectiveRef} showRoom={false} />
      </div>

      {/* Speech Bubble — compact, max 3 lines, at top */}
      {bubble && (
        <div className="absolute top-1 left-1 right-1 z-50 animate-fade-in pointer-events-none">
          <div className="relative px-3 py-2 rounded-xl bg-[#0d1220]/92 border border-cyan-400/25 backdrop-blur-sm shadow-[0_0_15px_rgba(34,211,238,0.12)]">
            <p className="text-[11px] font-mono text-cyber-text leading-relaxed break-words line-clamp-3">{bubble.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
