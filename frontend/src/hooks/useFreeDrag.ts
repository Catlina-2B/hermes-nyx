import { useState, useCallback, useRef, type RefObject } from "react";

const STORAGE_KEY = "hermes-avatar-pos";

interface Position { x: number; y: number }

function loadPosition(): Position | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p.x === "number" && typeof p.y === "number") return p;
  } catch { /* noop */ }
  return null;
}

function savePosition(pos: Position): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* noop */ }
}

export interface FreeDragCallbacks {
  onDragStart?: (mouseX: number, mouseY: number) => void;
  onDragMove?: (mouseX: number, mouseY: number) => void;
  onDragEnd?: (mouseX: number, mouseY: number) => void;
}

export function useFreeDrag(
  containerRef: RefObject<HTMLElement | null>,
  size: { w: number; h: number },
  callbacks?: FreeDragCallbacks,
  defaultPos?: Position,
) {
  const [pos, setPos] = useState<Position>(
    () => loadPosition() ?? defaultPos ?? { x: 0, y: 0 },
  );
  const [dragging, setDragging] = useState(false);
  const posRef = useRef(pos);
  posRef.current = pos;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    const cr = container.getBoundingClientRect();
    const startOffset = {
      x: e.clientX - cr.left - posRef.current.x,
      y: e.clientY - cr.top - posRef.current.y,
    };

    setDragging(true);
    callbacks?.onDragStart?.(e.clientX, e.clientY);

    const onMove = (ev: PointerEvent) => {
      const r = container.getBoundingClientRect();
      const clamped = {
        x: Math.max(0, Math.min(r.width - size.w, ev.clientX - r.left - startOffset.x)),
        y: Math.max(0, Math.min(r.height - size.h, ev.clientY - r.top - startOffset.y)),
      };
      posRef.current = clamped;
      setPos(clamped);
      callbacks?.onDragMove?.(ev.clientX, ev.clientY);
    };

    const onUp = (ev: PointerEvent) => {
      setDragging(false);
      savePosition(posRef.current);
      callbacks?.onDragEnd?.(ev.clientX, ev.clientY);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [containerRef, size, callbacks]);

  return { pos, dragging, onPointerDown };
}
