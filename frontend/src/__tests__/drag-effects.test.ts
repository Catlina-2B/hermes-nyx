import { describe, it, expect, vi, beforeEach } from "vitest";
import { DragEffectsEngine } from "../lib/drag-effects";

// Mock canvas
function createMockCanvas(): HTMLCanvasElement {
  const ctx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    roundRect: vi.fn(),
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    setTransform: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    shadowColor: "",
    shadowBlur: 0,
  };

  return {
    getContext: vi.fn().mockReturnValue(ctx),
    width: 0,
    height: 0,
    style: { width: "", height: "" },
  } as unknown as HTMLCanvasElement;
}

describe("DragEffectsEngine", () => {
  let engine: DragEffectsEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = createMockCanvas();
    engine = new DragEffectsEngine(canvas);
  });

  it("creates engine without errors", () => {
    expect(engine).toBeDefined();
  });

  it("resize sets canvas dimensions with DPR", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    engine.resize(800, 600);

    expect(canvas.width).toBe(1600); // 800 * 2
    expect(canvas.height).toBe(1200); // 600 * 2
    expect(canvas.style.width).toBe("800px");
    expect(canvas.style.height).toBe("600px");

    vi.unstubAllGlobals();
  });

  it("start begins animation loop", () => {
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
    engine.start();
    expect(rafSpy).toHaveBeenCalled();
    engine.stop();
    rafSpy.mockRestore();
  });

  it("stop cancels animation loop", () => {
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
    engine.stop();
    expect(cafSpy).toHaveBeenCalled();
    cafSpy.mockRestore();
  });

  it("onDragStart does not throw", () => {
    expect(() => engine.onDragStart(100, 100, null)).not.toThrow();
  });

  it("onDragMove does not throw when not dragging", () => {
    expect(() => engine.onDragMove(100, 100, null)).not.toThrow();
  });

  it("onDragMove does not throw when dragging", () => {
    engine.onDragStart(100, 100, null);
    expect(() => engine.onDragMove(150, 150, null)).not.toThrow();
  });

  it("onDragStop does not throw", () => {
    engine.onDragStart(100, 100, null);
    expect(() => engine.onDragStop(200, 200, null)).not.toThrow();
  });

  it("onDragStop with rect creates shockwave without error", () => {
    const rect = { left: 100, top: 100, width: 300, height: 400 } as DOMRect;
    engine.onDragStart(100, 100, rect);
    expect(() => engine.onDragStop(200, 200, rect)).not.toThrow();
  });

  it("dispose cleans up", () => {
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
    engine.dispose();
    expect(cafSpy).toHaveBeenCalled();
    cafSpy.mockRestore();
  });
});
