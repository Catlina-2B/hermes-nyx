import { describe, it, expect } from "vitest";
import { computeFluidLayout, type Rect } from "../lib/fluid-layout";

const CW = 1200; // container width
const CH = 800;  // container height

function assertWithinBounds(rect: Rect, label: string) {
  expect(rect.x, `${label}.x >= 0`).toBeGreaterThanOrEqual(0);
  expect(rect.y, `${label}.y >= 0`).toBeGreaterThanOrEqual(0);
  expect(rect.w, `${label}.w > 0`).toBeGreaterThan(0);
  expect(rect.h, `${label}.h > 0`).toBeGreaterThan(0);
  expect(rect.x + rect.w, `${label} right edge <= cw`).toBeLessThanOrEqual(CW + 1);
  expect(rect.y + rect.h, `${label} bottom edge <= ch`).toBeLessThanOrEqual(CH + 1);
}

describe("computeFluidLayout", () => {
  it("places chat on the left when avatar is on the right", () => {
    const avatar: Rect = { x: 880, y: 200, w: 320, h: 420 };
    const layout = computeFluidLayout(avatar, CW, CH);

    // Chat should be on the left side
    expect(layout.chat.x).toBe(0);
    expect(layout.chat.w).toBeLessThan(avatar.x);
    assertWithinBounds(layout.chat, "chat");
  });

  it("places chat on the right when avatar is on the left", () => {
    const avatar: Rect = { x: 0, y: 200, w: 320, h: 420 };
    const layout = computeFluidLayout(avatar, CW, CH);

    // Chat should be on the right side
    expect(layout.chat.x).toBeGreaterThan(avatar.x + avatar.w);
    assertWithinBounds(layout.chat, "chat");
  });

  it("log is above avatar and todo is below in normal case", () => {
    const avatar: Rect = { x: 880, y: 300, w: 320, h: 200 };
    const layout = computeFluidLayout(avatar, CW, CH);

    // Log above avatar
    expect(layout.log.y).toBe(0);
    expect(layout.log.h).toBeLessThanOrEqual(avatar.y);

    // Todo below avatar
    expect(layout.todo.y).toBeGreaterThanOrEqual(avatar.y + avatar.h);
    assertWithinBounds(layout.log, "log");
    assertWithinBounds(layout.todo, "todo");
  });

  it("stacks log and todo above when avatar is at bottom", () => {
    const avatar: Rect = { x: 880, y: 700, w: 320, h: 100 };
    const layout = computeFluidLayout(avatar, CW, CH);

    // Both log and todo should be above avatar
    expect(layout.log.y + layout.log.h).toBeLessThanOrEqual(avatar.y);
    expect(layout.todo.y + layout.todo.h).toBeLessThanOrEqual(avatar.y);
    assertWithinBounds(layout.log, "log");
    assertWithinBounds(layout.todo, "todo");
  });

  it("stacks log and todo below when avatar is at top", () => {
    const avatar: Rect = { x: 880, y: 0, w: 320, h: 100 };
    const layout = computeFluidLayout(avatar, CW, CH);

    // Both log and todo should be below avatar
    expect(layout.log.y).toBeGreaterThanOrEqual(avatar.y + avatar.h);
    expect(layout.todo.y).toBeGreaterThanOrEqual(avatar.y + avatar.h);
    assertWithinBounds(layout.log, "log");
    assertWithinBounds(layout.todo, "todo");
  });

  it("todo never overflows container bottom", () => {
    // Avatar at very bottom right
    const avatar: Rect = { x: 880, y: 750, w: 320, h: 50 };
    const layout = computeFluidLayout(avatar, CW, CH);

    expect(layout.todo.y + layout.todo.h).toBeLessThanOrEqual(CH);
  });

  it("all panels stay within container bounds for center avatar", () => {
    const avatar: Rect = { x: 440, y: 300, w: 320, h: 200 };
    const layout = computeFluidLayout(avatar, CW, CH);

    assertWithinBounds(layout.chat, "chat");
    assertWithinBounds(layout.log, "log");
    assertWithinBounds(layout.todo, "todo");
  });

  it("handles avatar at exact top-left corner", () => {
    const avatar: Rect = { x: 0, y: 0, w: 320, h: 420 };
    const layout = computeFluidLayout(avatar, CW, CH);

    assertWithinBounds(layout.chat, "chat");
    assertWithinBounds(layout.log, "log");
    assertWithinBounds(layout.todo, "todo");
  });

  it("handles avatar at exact bottom-right corner", () => {
    const avatar: Rect = { x: CW - 320, y: CH - 420, w: 320, h: 420 };
    const layout = computeFluidLayout(avatar, CW, CH);

    assertWithinBounds(layout.chat, "chat");
    // todo should not overflow
    expect(layout.todo.y + layout.todo.h).toBeLessThanOrEqual(CH + 1);
  });

  it("chat always has full container height", () => {
    const positions = [
      { x: 0, y: 0, w: 320, h: 420 },
      { x: 880, y: 200, w: 320, h: 420 },
      { x: 440, y: 400, w: 320, h: 200 },
    ];

    for (const avatar of positions) {
      const layout = computeFluidLayout(avatar, CW, CH);
      expect(layout.chat.h, `chat height for avatar at (${avatar.x},${avatar.y})`).toBe(CH);
    }
  });
});
