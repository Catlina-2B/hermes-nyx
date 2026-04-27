import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { DragEffectsEngine } from "../lib/drag-effects";

export interface DragEvent {
  type: "start" | "move" | "stop";
  mouseX: number;
  mouseY: number;
  panelRect: DOMRect | null;
}

export interface DragEffectsHandle {
  onDragEvent: (event: DragEvent) => void;
}

export default forwardRef<DragEffectsHandle>(function DragEffectsCanvas(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DragEffectsEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new DragEffectsEngine(canvas);
    engineRef.current = engine;

    const resize = () => engine.resize(window.innerWidth, window.innerHeight);
    resize();
    engine.start();

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    onDragEvent(event: DragEvent) {
      const engine = engineRef.current;
      if (!engine) return;
      switch (event.type) {
        case "start":
          engine.onDragStart(event.mouseX, event.mouseY, event.panelRect);
          break;
        case "move":
          engine.onDragMove(event.mouseX, event.mouseY, event.panelRect);
          break;
        case "stop":
          engine.onDragStop(event.mouseX, event.mouseY, event.panelRect);
          break;
      }
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
});
