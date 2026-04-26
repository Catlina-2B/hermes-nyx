export interface ParsedDirectives {
  text: string;
  directives: Record<string, unknown>[];
}

export function parseChatDirectives(raw: string): ParsedDirectives {
  const directives: Record<string, unknown>[] = [];
  let text = "";
  let i = 0;

  while (i < raw.length) {
    const start = raw.indexOf("[expr:", i);
    if (start === -1) {
      text += raw.slice(i);
      break;
    }

    text += raw.slice(i, start);
    const jsonStart = start + "[expr:".length;
    const parsedTag = readJsonTag(raw, jsonStart);

    if (!parsedTag) break;

    try {
      const parsed = JSON.parse(parsedTag.json);
      if (isRecord(parsed)) directives.push(parsed);
    } catch {
      // Drop invalid completed tags so implementation details never leak into chat.
    }

    i = parsedTag.end + 1;
  }

  return { text, directives };
}

function readJsonTag(raw: string, jsonStart: number): { json: string; end: number } | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let started = false;

  for (let i = jsonStart; i < raw.length; i++) {
    const ch = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      depth++;
      started = true;
      continue;
    }

    if (ch === "}" || ch === "]") {
      depth--;
      if (started && depth === 0) {
        if (raw[i + 1] !== "]") return null;
        return { json: raw.slice(jsonStart, i + 1), end: i + 1 };
      }
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
