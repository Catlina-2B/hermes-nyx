import { useState, useCallback, useEffect } from "react";
import type { Layout } from "react-grid-layout";

const STORAGE_KEY = "hermes-grid-layout";
const COLS = 12;
const GRID_GAP = 6;
const SYSTEM_BAR_H = 40;

function defaultLayout(): Layout[] {
  return [
    { i: "chat",   x: 0, y: 0, w: 9, h: 12, isDraggable: false, isResizable: false },
    { i: "log",    x: 9, y: 0, w: 3, h: 5,  isDraggable: false, isResizable: false },
    { i: "todo",   x: 9, y: 5, w: 3, h: 2,  isDraggable: false, isResizable: false },
    { i: "avatar", x: 9, y: 7, w: 3, h: 5,  isDraggable: true,  isResizable: false },
  ];
}

function loadLayout(): Layout[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Layout[];
    if (!Array.isArray(parsed) || parsed.length !== 4) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLayout(layout: Layout[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch { /* noop */ }
}

export function useGridLayout() {
  const [layout, setLayout] = useState<Layout[]>(() => loadLayout() ?? defaultLayout());
  const [rowHeight, setRowHeight] = useState(60);

  const recalcRowHeight = useCallback(() => {
    const available = window.innerHeight - SYSTEM_BAR_H - GRID_GAP * 13;
    setRowHeight(Math.max(40, Math.floor(available / 12)));
  }, []);

  useEffect(() => {
    recalcRowHeight();
    window.addEventListener("resize", recalcRowHeight);
    return () => window.removeEventListener("resize", recalcRowHeight);
  }, [recalcRowHeight]);

  const onLayoutChange = useCallback((newLayout: Layout[]) => {
    const merged = newLayout.map((item) => {
      const isAvatar = item.i === "avatar";
      return { ...item, isDraggable: isAvatar, isResizable: false };
    });
    setLayout(merged);
    saveLayout(merged);
  }, []);

  const resetLayout = useCallback(() => {
    const def = defaultLayout();
    setLayout(def);
    saveLayout(def);
  }, []);

  return {
    layout,
    rowHeight,
    cols: COLS,
    gap: GRID_GAP,
    onLayoutChange,
    resetLayout,
  };
}
