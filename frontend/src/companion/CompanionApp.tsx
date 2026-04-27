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

  return (
    <div className="relative w-full h-full select-none">
      {/* Drag handle — entire window is draggable */}
      <div
        onPointerDown={onDragStart}
        className="absolute inset-0 z-40 cursor-grab active:cursor-grabbing"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      {/* VRM Character */}
      <div className="absolute inset-0 z-10">
        <DigitalHumanPanel expressionCallbackRef={chatDirectiveRef} />
      </div>

      {/* Speech Bubble */}
      {bubble && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 max-w-[280px] animate-fade-in">
          <div className="relative px-4 py-2.5 rounded-2xl bg-[#0d1220]/90 border border-cyan-400/30 backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.15)]">
            <p className="text-xs font-mono text-cyber-text leading-relaxed">{bubble.text}</p>
            {/* Bubble tail */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-[#0d1220]/90 border-r border-b border-cyan-400/30" />
          </div>
        </div>
      )}
    </div>
  );
}
