export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GAP = 6;
const MIN_W = 120;
const MIN_H = 60;

/**
 * Compute panel positions so they flow around the avatar like water around oil.
 * Chat takes the wider side, Log + Todo stack on the avatar's side (above/below it).
 */
export function computeFluidLayout(
  avatar: Rect,
  cw: number,
  ch: number,
): { chat: Rect; log: Rect; todo: Rect } {
  const leftSpace = avatar.x;
  const rightSpace = cw - avatar.x - avatar.w;
  const chatOnLeft = leftSpace >= rightSpace;

  if (chatOnLeft) {
    const chatW = Math.max(MIN_W, avatar.x - GAP);

    // Side column: from avatar.x to right edge
    const sideX = avatar.x;
    const sideW = Math.max(MIN_W, cw - avatar.x);

    return {
      chat: { x: 0, y: 0, w: chatW, h: ch },
      log:  { x: sideX, y: 0, w: sideW, h: Math.max(MIN_H, avatar.y - GAP) },
      todo: {
        x: sideX,
        y: avatar.y + avatar.h + GAP,
        w: sideW,
        h: Math.max(MIN_H, ch - avatar.y - avatar.h - GAP),
      },
    };
  }

  // Chat on right
  const chatX = avatar.x + avatar.w + GAP;
  const chatW = Math.max(MIN_W, cw - chatX);

  const sideW = Math.max(MIN_W, avatar.x + avatar.w);

  return {
    chat: { x: chatX, y: 0, w: chatW, h: ch },
    log:  { x: 0, y: 0, w: sideW, h: Math.max(MIN_H, avatar.y - GAP) },
    todo: {
      x: 0,
      y: avatar.y + avatar.h + GAP,
      w: sideW,
      h: Math.max(MIN_H, ch - avatar.y - avatar.h - GAP),
    },
  };
}
