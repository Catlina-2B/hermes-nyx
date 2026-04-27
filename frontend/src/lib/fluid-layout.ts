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
 * Chat takes the wider side, Log + Todo stack on the avatar's side.
 *
 * When space below avatar is too small, Todo moves above avatar (sharing with Log).
 * When space above avatar is too small, Log moves below avatar (sharing with Todo).
 */
export function computeFluidLayout(
  avatar: Rect,
  cw: number,
  ch: number,
): { chat: Rect; log: Rect; todo: Rect } {
  const leftSpace = avatar.x;
  const rightSpace = cw - avatar.x - avatar.w;
  const chatOnLeft = leftSpace >= rightSpace;

  const chatW = chatOnLeft
    ? Math.max(MIN_W, avatar.x - GAP)
    : Math.max(MIN_W, cw - avatar.x - avatar.w - GAP);
  const chatX = chatOnLeft ? 0 : avatar.x + avatar.w + GAP;

  const sideX = chatOnLeft ? avatar.x : 0;
  const sideW = chatOnLeft
    ? Math.max(MIN_W, cw - avatar.x)
    : Math.max(MIN_W, avatar.x + avatar.w);

  const spaceAbove = avatar.y - GAP;
  const spaceBelow = ch - avatar.y - avatar.h - GAP;

  let log: Rect;
  let todo: Rect;

  if (spaceBelow < MIN_H && spaceAbove >= MIN_H * 2 + GAP) {
    // Not enough room below → stack Log + Todo ABOVE avatar
    const halfAbove = Math.floor((spaceAbove - GAP) / 2);
    log  = { x: sideX, y: 0, w: sideW, h: halfAbove };
    todo = { x: sideX, y: halfAbove + GAP, w: sideW, h: spaceAbove - halfAbove - GAP };
  } else if (spaceAbove < MIN_H && spaceBelow >= MIN_H * 2 + GAP) {
    // Not enough room above → stack Log + Todo BELOW avatar
    const belowY = avatar.y + avatar.h + GAP;
    const halfBelow = Math.floor((spaceBelow - GAP) / 2);
    log  = { x: sideX, y: belowY, w: sideW, h: halfBelow };
    todo = { x: sideX, y: belowY + halfBelow + GAP, w: sideW, h: spaceBelow - halfBelow - GAP };
  } else {
    // Normal: Log above, Todo below
    log = {
      x: sideX,
      y: 0,
      w: sideW,
      h: Math.max(MIN_H, spaceAbove),
    };
    todo = {
      x: sideX,
      y: avatar.y + avatar.h + GAP,
      w: sideW,
      h: Math.max(MIN_H, spaceBelow),
    };
    // Clamp todo within container
    if (todo.y + todo.h > ch) {
      todo.h = Math.max(0, ch - todo.y);
    }
  }

  return {
    chat: { x: chatX, y: 0, w: chatW, h: ch },
    log,
    todo,
  };
}
