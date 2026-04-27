# Canvas Drag Reflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dock-slot system with react-grid-layout for free-form panel reflow, and add a Canvas overlay for cyberpunk drag effects (particle trails, glow, shockwave).

**Architecture:** All panels (Chat, Log, Todo, Avatar) become items in a react-grid-layout grid. Only the Avatar panel is draggable; others are pushed/reflowed automatically. A full-screen Canvas overlay (pointer-events: none) renders visual effects synchronized with drag events via shared refs.

**Tech Stack:** react-grid-layout, Canvas 2D API, existing Tailwind + Three.js stack

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/hooks/useGridLayout.ts` | Grid layout state, persistence, resize calculation |
| Create | `src/components/DashboardGrid.tsx` | react-grid-layout wrapper, renders panels into grid items |
| Create | `src/lib/drag-effects.ts` | Canvas particle engine: trail, glow, shockwave, ambient |
| Create | `src/components/DragEffectsCanvas.tsx` | Full-screen Canvas overlay, bridges drag events → effects |
| Modify | `src/App.tsx` | Replace flex/dock layout with DashboardGrid + DragEffectsCanvas |
| Modify | `src/styles/global.css` | Add react-grid-layout overrides (placeholder, transitions) |
| Modify | `package.json` | Add react-grid-layout dependency |
| Delete | `src/hooks/useDock.ts` | Replaced by useGridLayout |
| Delete | `src/components/DropZone.tsx` | Replaced by react-grid-layout placeholders |

---

### Task 1: Install react-grid-layout

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install the package**

```bash
cd ./frontend
npm install react-grid-layout
npm install -D @types/react-grid-layout
```

- [ ] **Step 2: Verify installation**

```bash
cd ./frontend
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd .
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add react-grid-layout dependency"
```

---

### Task 2: Grid layout state hook

**Files:**
- Create: `src/hooks/useGridLayout.ts`

- [ ] **Step 1: Create useGridLayout hook**

This hook manages the grid layout array, calculates rowHeight from viewport, and persists the avatar position to localStorage.

```typescript
// src/hooks/useGridLayout.ts
import { useState, useCallback, useEffect } from "react";
import type { Layout } from "react-grid-layout";

const STORAGE_KEY = "hermes-grid-layout";
const COLS = 12;
const GRID_GAP = 6;
const SYSTEM_BAR_H = 40; // h-10 = 40px

/** Default layout: Chat left, Log+Todo+Avatar stacked right */
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

  /** Recalculate row height so 12 rows fill the viewport minus SystemBar */
  const recalcRowHeight = useCallback(() => {
    const available = window.innerHeight - SYSTEM_BAR_H - GRID_GAP * 13; // 13 gaps for 12 rows
    setRowHeight(Math.max(40, Math.floor(available / 12)));
  }, []);

  useEffect(() => {
    recalcRowHeight();
    window.addEventListener("resize", recalcRowHeight);
    return () => window.removeEventListener("resize", recalcRowHeight);
  }, [recalcRowHeight]);

  const onLayoutChange = useCallback((newLayout: Layout[]) => {
    // Preserve isDraggable/isResizable flags (react-grid-layout strips them)
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
```

- [ ] **Step 2: Type-check**

```bash
cd ./frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd .
git add frontend/src/hooks/useGridLayout.ts
git commit -m "feat: add useGridLayout hook for grid state management"
```

---

### Task 3: Dashboard grid component

**Files:**
- Create: `src/components/DashboardGrid.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add react-grid-layout CSS overrides to global.css**

Append to `src/styles/global.css`:

```css
/* react-grid-layout overrides */
.react-grid-layout {
  position: relative;
}

.react-grid-item {
  transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1);
}

.react-grid-item.cssTransforms {
  transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1);
}

.react-grid-item.react-draggable-dragging {
  transition: none;
  z-index: 40;
  opacity: 0.92;
  box-shadow: 0 0 30px rgba(0, 255, 200, 0.25), 0 0 60px rgba(0, 255, 200, 0.1);
  border-radius: 8px;
}

.react-grid-placeholder {
  background: rgba(0, 255, 200, 0.08) !important;
  border: 2px dashed rgba(0, 255, 200, 0.3) !important;
  border-radius: 8px;
  box-shadow: 0 0 20px rgba(0, 255, 200, 0.1);
}

.react-grid-item > .react-resizable-handle {
  display: none;
}
```

- [ ] **Step 2: Create DashboardGrid component**

```tsx
// src/components/DashboardGrid.tsx
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
```

- [ ] **Step 3: Type-check**

```bash
cd ./frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd .
git add frontend/src/components/DashboardGrid.tsx frontend/src/styles/global.css
git commit -m "feat: add DashboardGrid component with cyberpunk-styled grid layout"
```

---

### Task 4: Refactor App.tsx to use grid layout

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Rewrite App.tsx**

Replace the entire flex/dock layout with DashboardGrid. The Avatar panel gets a drag handle; all panels render as grid items.

```tsx
// src/App.tsx
import { useRef, useCallback } from "react";
import { useChat } from "./hooks/useChat";
import { useLogs } from "./hooks/useLogs";
import { useTodos } from "./hooks/useTodos";
import { useGridLayout } from "./hooks/useGridLayout";
import SystemBar from "./components/SystemBar";
import ChatPanel from "./components/ChatPanel";
import LogPanel from "./components/LogPanel";
import TodoPanel from "./components/TodoPanel";
import DashboardGrid, { type DragEvent } from "./components/DashboardGrid";
import DigitalHumanPanel from "./plugins/vrm-digital-human/DigitalHumanPanel";
import { frontendPlugins } from "./plugins/registry";
import type { ChatDirectiveHandler } from "./plugins/types";

export default function App() {
  const chatDirectiveRef = useRef<ChatDirectiveHandler | null>(null);
  const chat = useChat(chatDirectiveRef);
  const logs = useLogs();
  const { todos, add, toggle, remove } = useTodos();
  const grid = useGridLayout();

  const handleDragEvent = useCallback((event: DragEvent) => {
    // Will be connected to Canvas effects in Task 7
    void event;
  }, []);

  const gridChildren = [
    {
      key: "chat",
      node: (
        <ChatPanel
          messages={chat.messages}
          streaming={chat.streaming}
          sessions={chat.sessions}
          onSend={chat.send}
          onInterrupt={chat.interrupt}
          onNewSession={chat.newSession}
          onSwitchSession={chat.switchSession}
        />
      ),
    },
    {
      key: "log",
      node: (
        <LogPanel
          rawLogs={logs.rawLogs}
          summaries={logs.summaries}
          connected={logs.connected}
        />
      ),
    },
    {
      key: "todo",
      node: (
        <TodoPanel
          todos={todos}
          onAdd={add}
          onToggle={toggle}
          onRemove={remove}
        />
      ),
    },
    {
      key: "avatar",
      node: (
        <div className="relative h-full w-full">
          {/* Drag handle — visible on hover */}
          <div className="drag-handle absolute inset-x-0 top-0 z-40 h-9 cursor-grab active:cursor-grabbing group">
            <div className="absolute left-1/2 -translate-x-1/2 top-3 flex items-center gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className="block w-[3px] h-[3px] rounded-full bg-cyan-300/60" />
              ))}
            </div>
          </div>
          <DigitalHumanPanel expressionCallbackRef={chatDirectiveRef} />
        </div>
      ),
    },
  ];

  return (
    <div className="h-screen flex flex-col bg-cyber-bg">
      <SystemBar chatConnected={chat.connected} />

      <DashboardGrid
        layout={grid.layout}
        rowHeight={grid.rowHeight}
        cols={grid.cols}
        gap={grid.gap}
        onLayoutChange={grid.onLayoutChange}
        onDragEvent={handleDragEvent}
      >
        {gridChildren}
      </DashboardGrid>

      {/* Plugin overlays */}
      {frontendPlugins.map((plugin) =>
        plugin.renderOverlay ? (
          <div key={plugin.id}>{plugin.renderOverlay({ chatDirectiveRef })}</div>
        ) : null,
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and build**

```bash
cd ./frontend && npx tsc --noEmit && npx vite build
```

Expected: both pass

- [ ] **Step 3: Manual verification**

```bash
cd ./frontend && npx vite --open
```

Verify:
- All 4 panels render in a grid (Chat large left, Log/Todo/Avatar stacked right)
- Hovering avatar panel top shows grip dots
- Dragging avatar panel causes other panels to reflow
- Dropping avatar saves position (refresh keeps layout)
- Grid placeholder shows during drag (dashed cyan border)

- [ ] **Step 4: Commit**

```bash
cd .
git add frontend/src/App.tsx
git commit -m "feat: replace flex/dock layout with react-grid-layout dashboard"
```

---

### Task 5: Canvas particle effect engine

**Files:**
- Create: `src/lib/drag-effects.ts`

- [ ] **Step 1: Create the particle engine**

This is a self-contained Canvas 2D engine that renders four effect types: ambient particles, drag trail, panel glow, and drop shockwave.

```typescript
// src/lib/drag-effects.ts

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;     // 0..1, decreases each frame
  decay: number;    // life lost per second
  size: number;
  color: string;    // CSS color without alpha
  alpha: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  width: number;
  height: number;
}

interface GlowTarget {
  rect: DOMRect;
  intensity: number; // 0..1, lerps toward target
}

const CYAN = "34,211,238";
const GREEN = "0,255,200";

export class DragEffectsEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private lastTime = 0;

  // Ambient
  private ambient: Particle[] = [];
  private readonly AMBIENT_COUNT = 35;

  // Trail
  private trail: Particle[] = [];
  private dragging = false;

  // Glow
  private glow: GlowTarget | null = null;
  private glowIntensity = 0;

  // Shockwave
  private shockwaves: Shockwave[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.initAmbient();
  }

  /** Resize canvas to match container */
  resize(w: number, h: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Start render loop */
  start(): void {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.05); // cap at 50ms
      this.lastTime = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Stop render loop */
  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  // --- Public API ---

  onDragStart(mouseX: number, mouseY: number, rect: DOMRect | null): void {
    this.dragging = true;
    this.trail = [];
    if (rect) {
      this.glow = { rect, intensity: 1 };
    }
    this.emitTrailBurst(mouseX, mouseY, 8);
  }

  onDragMove(mouseX: number, mouseY: number, rect: DOMRect | null): void {
    if (!this.dragging) return;
    this.emitTrailParticles(mouseX, mouseY, 2);
    if (rect) {
      this.glow = { rect, intensity: 1 };
    }
  }

  onDragStop(mouseX: number, mouseY: number, rect: DOMRect | null): void {
    this.dragging = false;
    this.emitTrailBurst(mouseX, mouseY, 15);
    if (rect) {
      this.shockwaves.push({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        radius: 0,
        maxRadius: Math.max(rect.width, rect.height) * 1.2,
        life: 1,
        width: rect.width,
        height: rect.height,
      });
    }
    this.glow = null;
  }

  // --- Particle factories ---

  private initAmbient(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.ambient = Array.from({ length: this.AMBIENT_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 8,
      life: 1,
      decay: 0, // ambient never dies
      size: 1 + Math.random() * 1.5,
      color: Math.random() > 0.5 ? CYAN : GREEN,
      alpha: 0.15 + Math.random() * 0.2,
    }));
  }

  private emitTrailParticles(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.trail.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 40,
        vy: -20 - Math.random() * 50,
        life: 1,
        decay: 1.5 + Math.random() * 1.0,
        size: 1.5 + Math.random() * 2.5,
        color: CYAN,
        alpha: 0.7 + Math.random() * 0.3,
      });
    }
  }

  private emitTrailBurst(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      this.trail.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 1.2 + Math.random() * 0.8,
        size: 2 + Math.random() * 3,
        color: GREEN,
        alpha: 0.8,
      });
    }
  }

  // --- Update ---

  private update(dt: number): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Ambient: wrap around screen
    for (const p of this.ambient) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0) p.x += w;
      if (p.x > w) p.x -= w;
      if (p.y < 0) p.y += h;
      if (p.y > h) p.y -= h;
      p.alpha = 0.15 + Math.sin(performance.now() * 0.001 + p.x * 0.01) * 0.1;
    }

    // Trail: move and decay
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        this.trail.splice(i, 1);
      }
    }

    // Glow intensity
    if (this.glow) {
      this.glowIntensity += (this.glow.intensity - this.glowIntensity) * 0.15;
    } else {
      this.glowIntensity *= 0.9;
    }

    // Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.maxRadius * dt * 2.5;
      sw.life -= dt * 2;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }
  }

  // --- Draw ---

  private draw(): void {
    const { ctx } = this;
    const w = this.canvas.style.width ? parseInt(this.canvas.style.width) : window.innerWidth;
    const h = this.canvas.style.height ? parseInt(this.canvas.style.height) : window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    this.drawAmbient(ctx);
    this.drawTrail(ctx);
    this.drawGlow(ctx);
    this.drawShockwaves(ctx);
  }

  private drawAmbient(ctx: CanvasRenderingContext2D): void {
    for (const p of this.ambient) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
      ctx.fill();
    }
  }

  private drawTrail(ctx: CanvasRenderingContext2D): void {
    for (const p of this.trail) {
      const a = p.alpha * p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${a})`;
      ctx.fill();

      // Glow around each particle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${a * 0.15})`;
      ctx.fill();
    }
  }

  private drawGlow(ctx: CanvasRenderingContext2D): void {
    if (this.glowIntensity < 0.01) return;
    const g = this.glow;
    if (!g) return;

    const { rect } = g;
    const a = this.glowIntensity;

    ctx.save();
    ctx.shadowColor = `rgba(${CYAN},${0.6 * a})`;
    ctx.shadowBlur = 25 * a;
    ctx.strokeStyle = `rgba(${CYAN},${0.4 * a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rect.left, rect.top, rect.width, rect.height, 8);
    ctx.stroke();
    ctx.restore();

    // Corner accents
    const cornerLen = 12;
    ctx.strokeStyle = `rgba(${GREEN},${0.7 * a})`;
    ctx.lineWidth = 2;
    const corners = [
      [rect.left, rect.top],
      [rect.right, rect.top],
      [rect.right, rect.bottom],
      [rect.left, rect.bottom],
    ];
    const dirs = [
      [1, 1], [-1, 1], [-1, -1], [1, -1],
    ];
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = corners[i];
      const [dx, dy] = dirs[i];
      ctx.beginPath();
      ctx.moveTo(cx, cy + dy * cornerLen);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + dx * cornerLen, cy);
      ctx.stroke();
    }
  }

  private drawShockwaves(ctx: CanvasRenderingContext2D): void {
    for (const sw of this.shockwaves) {
      const a = sw.life * 0.5;
      ctx.save();
      ctx.strokeStyle = `rgba(${CYAN},${a})`;
      ctx.lineWidth = 2 * sw.life;
      ctx.shadowColor = `rgba(${CYAN},${a * 0.5})`;
      ctx.shadowBlur = 15 * sw.life;
      ctx.beginPath();
      // Elliptical shockwave matching panel proportions
      ctx.ellipse(sw.x, sw.y, sw.radius, sw.radius * (sw.height / sw.width), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  dispose(): void {
    this.stop();
    this.trail = [];
    this.shockwaves = [];
    this.ambient = [];
  }
}
```

- [ ] **Step 2: Type-check**

```bash
cd ./frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd .
git add frontend/src/lib/drag-effects.ts
git commit -m "feat: add Canvas particle engine for drag effects"
```

---

### Task 6: DragEffectsCanvas overlay component

**Files:**
- Create: `src/components/DragEffectsCanvas.tsx`

- [ ] **Step 1: Create the overlay component**

This component renders a full-screen Canvas overlay, creates the DragEffectsEngine on mount, and exposes a ref-based API for receiving drag events from DashboardGrid.

```tsx
// src/components/DragEffectsCanvas.tsx
import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { DragEffectsEngine } from "../lib/drag-effects";
import type { DragEvent } from "./DashboardGrid";

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
```

- [ ] **Step 2: Type-check**

```bash
cd ./frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd .
git add frontend/src/components/DragEffectsCanvas.tsx
git commit -m "feat: add DragEffectsCanvas overlay component"
```

---

### Task 7: Connect drag events to Canvas effects

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Wire up the Canvas effects ref to DashboardGrid drag events**

Update App.tsx to create a ref for DragEffectsCanvas and pass drag events through:

```tsx
// Changes to App.tsx:
// 1. Add imports
import DragEffectsCanvas, { type DragEffectsHandle } from "./components/DragEffectsCanvas";

// 2. Add ref inside App component
const effectsRef = useRef<DragEffectsHandle>(null);

// 3. Replace handleDragEvent
const handleDragEvent = useCallback((event: DragEvent) => {
  effectsRef.current?.onDragEvent(event);
}, []);

// 4. Add DragEffectsCanvas to JSX (before closing </div>)
<DragEffectsCanvas ref={effectsRef} />
```

The full return JSX becomes:

```tsx
  return (
    <div className="h-screen flex flex-col bg-cyber-bg">
      <SystemBar chatConnected={chat.connected} />

      <DashboardGrid
        layout={grid.layout}
        rowHeight={grid.rowHeight}
        cols={grid.cols}
        gap={grid.gap}
        onLayoutChange={grid.onLayoutChange}
        onDragEvent={handleDragEvent}
      >
        {gridChildren}
      </DashboardGrid>

      {/* Plugin overlays */}
      {frontendPlugins.map((plugin) =>
        plugin.renderOverlay ? (
          <div key={plugin.id}>{plugin.renderOverlay({ chatDirectiveRef })}</div>
        ) : null,
      )}

      <DragEffectsCanvas ref={effectsRef} />
    </div>
  );
```

- [ ] **Step 2: Type-check and build**

```bash
cd ./frontend && npx tsc --noEmit && npx vite build
```

Expected: both pass

- [ ] **Step 3: Manual verification**

```bash
cd ./frontend && npx vite --open
```

Verify:
- Ambient particles float gently across the screen
- Dragging the avatar panel shows cyan particle trail following cursor
- Dragging shows glowing border around the avatar panel with corner accents
- Dropping the avatar panel triggers expanding elliptical shockwave
- Other panels reflow smoothly with CSS transitions
- All effects use cyberpunk cyan/green color scheme
- Effects canvas doesn't block mouse events on panels below

- [ ] **Step 4: Commit**

```bash
cd .
git add frontend/src/App.tsx
git commit -m "feat: connect drag events to Canvas effects layer"
```

---

### Task 8: Cleanup old dock system

**Files:**
- Delete: `src/hooks/useDock.ts`
- Delete: `src/components/DropZone.tsx`
- Modify: `src/plugins/vrm-digital-human/index.tsx` (remove unused renderSidebarBottom since panel is rendered directly)

- [ ] **Step 1: Remove old files**

```bash
cd ./frontend
rm src/hooks/useDock.ts src/components/DropZone.tsx
```

- [ ] **Step 2: Update plugin to remove sidebar rendering**

The VRM plugin's `renderSidebarBottom` is no longer used since the avatar panel is rendered directly in App.tsx's grid. Update the plugin to only provide an ID and name (preserving the interface for future overlay use):

```tsx
// src/plugins/vrm-digital-human/index.tsx
import type { HermesFrontendPlugin } from "../types";

export const vrmDigitalHumanPlugin: HermesFrontendPlugin = {
  id: "vrm-digital-human",
  name: "VRM Digital Human",
};
```

- [ ] **Step 3: Type-check and build**

```bash
cd ./frontend && npx tsc --noEmit && npx vite build
```

Expected: both pass, no unused import warnings

- [ ] **Step 4: Commit**

```bash
cd .
git add -A
git commit -m "refactor: remove old dock system, replaced by grid layout"
```

---

## Implementation Notes

**Grid width detection:** `DashboardGrid` uses `containerRef.current?.clientWidth` which is `undefined` on first render. The grid renders with `window.innerWidth` initially, then corrects on the next render when the ref attaches. If this causes a layout flash, wrap the width in a `useLayoutEffect` + state pattern.

**VRM panel remount:** When react-grid-layout reflows items, DOM elements are moved via CSS transforms — the React component tree does NOT remount. The VRM 3D renderer and WebGL context survive position changes. This is a key advantage over the old conditional-render dock system.

**Performance:** The Canvas effects engine caps delta time at 50ms and uses ~35 ambient particles + burst-based trail particles. Total particle count stays under 200 even during active dragging. The engine uses a single requestAnimationFrame loop.

**Drag handle:** The `draggableHandle: ".drag-handle"` option restricts drag initiation to the grip dots area at the top of the avatar panel. Users can still interact normally with the avatar panel below the handle.
