import { useRef, useState, useEffect, useCallback } from "react";
import DigitalHumanPanel from "../plugins/vrm-digital-human/DigitalHumanPanel";
import {
  AVATAR_MODEL_STORAGE_KEY,
  normalizeAvatarModelPath,
} from "../plugins/vrm-digital-human/model-options";
import type { ChatDirectiveHandler } from "../plugins/types";

interface BubbleMessage {
  text: string;
  id: number;
}

let msgId = 0;

export default function CompanionApp() {
  const chatDirectiveRef = useRef<ChatDirectiveHandler | null>(null);
  const [bubble, setBubble] = useState<BubbleMessage | null>(null);
  const [companionEnabled, setCompanionEnabled] = useState(false);
  const [avatarModelPath, setAvatarModelPath] = useState(() => {
    try {
      return normalizeAvatarModelPath(localStorage.getItem(AVATAR_MODEL_STORAGE_KEY));
    } catch {
      return normalizeAvatarModelPath(null);
    }
  });

  // Override global.css body background for transparent window
  useEffect(() => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === AVATAR_MODEL_STORAGE_KEY) {
        setAvatarModelPath(normalizeAvatarModelPath(event.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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

  // Listen for companion mode state changes from Electron
  useEffect(() => {
    const hermesDesktop = (window as any).hermesDesktop;
    if (!hermesDesktop?.onCompanionStateChange) return;
    hermesDesktop.onCompanionStateChange((enabled: boolean) => {
      setCompanionEnabled(enabled);
    });
  }, []);

  // Click-through on transparent regions. The character is rendered to a
  // WebGL canvas, so we sample the alpha at the cursor position and toggle
  // setIgnoreMouseEvents accordingly. Without this the whole 400x500 window
  // (mostly transparent) acts as a drag handle and the cursor turns into a
  // grab-hand even when the user is far from the character.
  useEffect(() => {
    const ipc = (window as any).hermesDesktop;
    if (!ipc?.setCompanionMousePassthrough) return;

    let lastIgnore: boolean | null = null;
    let rafScheduled = false;
    let pendingEvent: { x: number; y: number } | null = null;

    const setPassthrough = (ignore: boolean) => {
      if (ignore === lastIgnore) return;
      lastIgnore = ignore;
      ipc.setCompanionMousePassthrough(ignore);
    };

    const sample = () => {
      rafScheduled = false;
      const ev = pendingEvent;
      pendingEvent = null;
      if (!ev) return;

      // If the cursor is over an interactive HTML element (e.g. the
      // right-click context menu, speech bubble link), keep mouse capture
      // on so it can receive clicks. Sampling the canvas behind it would
      // wrongly turn passthrough on and break the menu.
      const top = document.elementFromPoint(ev.x, ev.y);
      if (top && top.closest("[data-companion-interactive]")) {
        setPassthrough(false);
        return;
      }

      const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
      if (!canvas) {
        setPassthrough(true);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      if (
        ev.x < rect.left || ev.x > rect.right ||
        ev.y < rect.top || ev.y > rect.bottom
      ) {
        setPassthrough(true);
        return;
      }

      const px = Math.floor((ev.x - rect.left) * (canvas.width / rect.width));
      const py = Math.floor((ev.y - rect.top) * (canvas.height / rect.height));
      const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as
        | WebGLRenderingContext | WebGL2RenderingContext | null;
      if (!gl) return;
      const pixel = new Uint8Array(4);
      // WebGL Y is bottom-up.
      gl.readPixels(
        px, canvas.height - py - 1, 1, 1,
        gl.RGBA, gl.UNSIGNED_BYTE, pixel,
      );
      setPassthrough(pixel[3] === 0);
    };

    const onMove = (ev: MouseEvent) => {
      pendingEvent = { x: ev.clientX, y: ev.clientY };
      if (!rafScheduled) {
        rafScheduled = true;
        requestAnimationFrame(sample);
      }
    };

    // Default: assume passthrough until we sample. Otherwise the window
    // would catch a click before the first mousemove.
    setPassthrough(true);
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      // Restore mouse capture so dev reloads / next session aren't broken.
      ipc.setCompanionMousePassthrough(false);
    };
  }, []);

  // Right-click context menu
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const hd = (window as any).hermesDesktop;
    if (!hd) return;

    const menu = document.createElement("div");
    menu.className = "fixed z-[9999] py-1 rounded-lg border border-cyan-400/20 bg-[#0d1220]/95 backdrop-blur-xl shadow-[0_0_30px_rgba(34,211,238,0.12)] min-w-[160px]";
    menu.setAttribute("data-companion-interactive", "true");
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    // Item: 实时陪伴模式
    const companionItem = document.createElement("button");
    companionItem.textContent = companionEnabled ? "✓ 实时陪伴模式" : "  实时陪伴模式";
    companionItem.className = "block w-full text-left px-4 py-2 text-xs font-mono text-cyan-200 hover:bg-cyan-400/10 transition-colors";
    companionItem.onclick = () => {
      hd.toggleCompanion?.();
      if (document.body.contains(menu)) document.body.removeChild(menu);
    };
    menu.appendChild(companionItem);

    // Item: 立即观察
    const captureItem = document.createElement("button");
    captureItem.textContent = "  立即观察 ⌘⇧S";
    captureItem.className = "block w-full text-left px-4 py-2 text-xs font-mono text-cyan-200 hover:bg-cyan-400/10 transition-colors";
    captureItem.onclick = () => {
      hd.captureNow?.();
      if (document.body.contains(menu)) document.body.removeChild(menu);
    };
    menu.appendChild(captureItem);

    // Separator
    const sep = document.createElement("div");
    sep.className = "my-1 border-t border-cyan-400/10";
    menu.appendChild(sep);

    // Item: 移至客户端内
    const switchItem = document.createElement("button");
    switchItem.textContent = "  移至客户端内";
    switchItem.className = "block w-full text-left px-4 py-2 text-xs font-mono text-cyan-200 hover:bg-cyan-400/10 transition-colors";
    switchItem.onclick = () => {
      hd.switchAvatarTo?.("webui");
      if (document.body.contains(menu)) document.body.removeChild(menu);
    };
    menu.appendChild(switchItem);

    const dismiss = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        if (document.body.contains(menu)) document.body.removeChild(menu);
        document.removeEventListener("mousedown", dismiss);
      }
    };
    document.addEventListener("mousedown", dismiss);
    document.body.appendChild(menu);
  }, [companionEnabled]);

  return (
    <div className="relative w-full h-full select-none">
      {/* Drag handle — covers the whole window for hit-testing, but the
          cursor stays default until the user actually begins dragging.
          Click-through on transparent areas is handled by the WebGL alpha
          sampler that toggles setIgnoreMouseEvents in the main process. */}
      <div
        onPointerDown={onDragStart}
        onContextMenu={onContextMenu}
        className="absolute inset-0 z-40 active:cursor-grabbing"
      />

      {/* VRM Character */}
      <div className="absolute inset-0 z-10">
        <DigitalHumanPanel
          expressionCallbackRef={chatDirectiveRef}
          modelPath={avatarModelPath}
          showRoom={false}
        />
      </div>

      {/* Speech Bubble — compact, max 3 lines, at top */}
      {bubble && (
        <div className="absolute top-2 left-2 z-50 animate-fade-in pointer-events-none max-w-[85%]">
          <div className="relative px-3 py-2 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <p className="text-[11px] font-sans text-white leading-relaxed break-words line-clamp-3">{bubble.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
