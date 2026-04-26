import { useRef, useCallback, type ReactNode } from "react";
import GridLayout from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";

export interface DragEvent {
  type: "start" | "move" | "stop";
  mouseX: number;
  mouseY: number;
  panelRect: DOMRect | null;
}

interface Props {
  layout: Layout[];
  rowHeight: number;
  cols: number;
  gap: number;
  onLayoutChange: (layout: Layout[]) => void;
  onDragEvent?: (event: DragEvent) => void;
  children: { key: string; node: ReactNode }[];
}

export default function DashboardGrid({
  layout,
  rowHeight,
  cols,
  gap,
  onLayoutChange,
  onDragEvent,
  children,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth;

  const findPanelRect = useCallback((element: HTMLElement): DOMRect | null => {
    const gridItem = element.closest(".react-grid-item") as HTMLElement | null;
    return gridItem?.getBoundingClientRect() ?? null;
  }, []);

  const handleDragStart = useCallback(
    (_layout: Layout[], _old: Layout, _new: Layout, _ph: Layout, e: MouseEvent, element: HTMLElement) => {
      onDragEvent?.({ type: "start", mouseX: e.clientX, mouseY: e.clientY, panelRect: findPanelRect(element) });
    },
    [onDragEvent, findPanelRect],
  );

  const handleDrag = useCallback(
    (_layout: Layout[], _old: Layout, _new: Layout, _ph: Layout, e: MouseEvent, element: HTMLElement) => {
      onDragEvent?.({ type: "move", mouseX: e.clientX, mouseY: e.clientY, panelRect: findPanelRect(element) });
    },
    [onDragEvent, findPanelRect],
  );

  const handleDragStop = useCallback(
    (_layout: Layout[], _old: Layout, _new: Layout, _ph: Layout, e: MouseEvent, element: HTMLElement) => {
      onDragEvent?.({ type: "stop", mouseX: e.clientX, mouseY: e.clientY, panelRect: findPanelRect(element) });
    },
    [onDragEvent, findPanelRect],
  );

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden">
      <GridLayout
        className="react-grid-layout"
        layout={layout}
        cols={cols}
        rowHeight={rowHeight}
        width={containerWidth}
        margin={[gap, gap]}
        compactType="vertical"
        onLayoutChange={onLayoutChange}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        useCSSTransforms
        draggableHandle=".drag-handle"
      >
        {children.map(({ key, node }) => (
          <div key={key} className="overflow-hidden rounded-lg border border-cyber-border bg-cyber-panel">
            {node}
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
