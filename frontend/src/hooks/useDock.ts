import { useState, useCallback } from "react";

export type DockPosition =
  | "sidebar-top"
  | "sidebar-mid"
  | "sidebar-bottom"
  | "main-bottom"
  | "main-left";

const KEY = "hermes-dock-pos";
const VALID = new Set<string>([
  "sidebar-top", "sidebar-mid", "sidebar-bottom", "main-bottom", "main-left",
]);

export function useDock(initial: DockPosition = "sidebar-bottom") {
  const [position, setPosition] = useState<DockPosition>(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v && VALID.has(v)) return v as DockPosition;
    } catch { /* noop */ }
    return initial;
  });
  const [dragging, setDragging] = useState(false);

  const moveTo = useCallback((pos: DockPosition) => {
    setPosition(pos);
    setDragging(false);
    try { localStorage.setItem(KEY, pos); } catch { /* noop */ }
  }, []);

  return { position, dragging, setDragging, moveTo } as const;
}
