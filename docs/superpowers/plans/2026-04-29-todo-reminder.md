# Todo Deadline Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Todo items with time-sensitive content get a desktop popup reminder 10 minutes before their deadline.

**Architecture:** When a todo is created, the backend calls LLM to extract a deadline from the content. Electron polls a reminders endpoint every 30s and opens a persistent popup window for todos due within 10 minutes. The popup stays until the user manually closes it.

**Tech Stack:** Python/FastAPI (backend), OpenAI API (time extraction), Electron BrowserWindow (popup), React (popup UI)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/todo_reminder.py` | LLM-based deadline extraction from todo content |
| Modify | `backend/todo_store.py` | Add `deadline` and `reminded` fields to todo data |
| Modify | `backend/main.py` | Call deadline extraction on todo create; add reminders + reminded endpoints |
| Create | `frontend/reminder.html` | HTML entry for reminder popup window |
| Create | `frontend/src/reminder/ReminderApp.tsx` | Reminder popup React component |
| Create | `frontend/src/reminder/reminder-entry.tsx` | React entry point for reminder window |
| Modify | `frontend/vite.config.ts` | Add reminder entry point to multi-page build |
| Modify | `electron/main.js` | Poll reminders, create/manage reminder popup windows |
| Modify | `electron/preload.js` | Add IPC for dismissing reminder |
| Modify | `frontend/src/components/TodoPanel.tsx` | Show deadline badge on todo items |

---

### Task 1: Backend — Deadline Extraction Module

**Files:**
- Create: `backend/todo_reminder.py`

- [ ] **Step 1: Create `backend/todo_reminder.py`**

```python
"""Extract deadline from todo content using LLM."""

import os
import json
from datetime import datetime
from pathlib import Path

# Load ~/.hermes/.env for API key
_env_path = Path.home() / ".hermes" / ".env"
if _env_path.exists():
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


def _get_client():
    if not OpenAI:
        return None
    api_key = os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("OPENAI_BASE_URL")
    if not api_key:
        return None
    return OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI(api_key=api_key)


def _get_model():
    try:
        from config import load_hermes_config
        raw = load_hermes_config().get("model", {})
        if isinstance(raw, dict):
            return raw.get("default", "gpt-4o")
        return raw or "gpt-4o"
    except Exception:
        return "gpt-4o"


async def extract_deadline(content: str) -> str | None:
    """Extract deadline from todo content. Returns ISO datetime string or None."""
    client = _get_client()
    if not client:
        return None

    now = datetime.now()
    prompt = f"""当前时间: {now.strftime("%Y-%m-%d %H:%M %A")}

分析以下待办事项内容，提取其中的截止时间或事件发生时间。

规则:
- 如果内容中有明确的时间（如"3点"、"下午5点"、"15:00"、"明天上午10点"），提取并转为完整的 ISO 8601 格式
- "3点"默认指下午15:00（除非上下文明确是凌晨）
- "明天"指 {(now.replace(hour=0, minute=0) + __import__('datetime').timedelta(days=1)).strftime("%Y-%m-%d")}
- 如果没有任何时间相关信息，返回 null
- 只返回 JSON，不要其他文字

待办内容: {content}

返回格式: {{"deadline": "2026-04-29T15:00:00" 或 null}}"""

    try:
        response = client.chat.completions.create(
            model=_get_model(),
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=100,
        )
        text = response.choices[0].message.content.strip()
        # Strip markdown fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        data = json.loads(text)
        return data.get("deadline")
    except Exception as e:
        print(f"[todo-reminder] Failed to extract deadline: {e}")
        return None
```

- [ ] **Step 2: Verify file was created**

Run: `cd /Users/liu/test/hermes-webui && python3 -c "import ast; ast.parse(open('backend/todo_reminder.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/todo_reminder.py
git commit -m "feat(reminder): add LLM-based deadline extraction module"
```

---

### Task 2: Backend — Extend Todo Store with Deadline Fields

**Files:**
- Modify: `backend/todo_store.py`

- [ ] **Step 1: Update `add_todo` and `add_todo_with_id` to accept `deadline` parameter**

In `backend/todo_store.py`, modify both functions to include `deadline` and `reminded` fields:

```python
def add_todo_with_id(todo_id: str, content: str, completed: bool = False, deadline: str | None = None) -> dict:
    todos = _load()
    todo = {
        "id": todo_id,
        "content": content,
        "completed": completed,
        "created_at": datetime.now().isoformat(),
        "deadline": deadline,
        "reminded": False,
    }
    todos.append(todo)
    _save(todos)
    return todo


def add_todo(content: str, deadline: str | None = None) -> dict:
    todos = _load()
    todo = {
        "id": str(uuid.uuid4())[:8],
        "content": content,
        "completed": False,
        "created_at": datetime.now().isoformat(),
        "deadline": deadline,
        "reminded": False,
    }
    todos.append(todo)
    _save(todos)
    return todo
```

- [ ] **Step 2: Add `get_pending_reminders` and `mark_reminded` functions**

Append to `backend/todo_store.py`:

```python
def get_pending_reminders(within_minutes: int = 10) -> list[dict]:
    """Return todos with deadlines within N minutes that haven't been reminded."""
    todos = _load()
    now = datetime.now()
    result = []
    for todo in todos:
        if todo.get("completed") or todo.get("reminded") or not todo.get("deadline"):
            continue
        try:
            deadline = datetime.fromisoformat(todo["deadline"])
            diff = (deadline - now).total_seconds()
            # Due within N minutes and not already past by more than 5 minutes
            if diff <= within_minutes * 60 and diff >= -300:
                result.append(todo)
        except (ValueError, TypeError):
            continue
    return result


def mark_reminded(todo_id: str) -> dict | None:
    """Mark a todo as reminded so it won't trigger again."""
    todos = _load()
    for todo in todos:
        if todo["id"] == todo_id:
            todo["reminded"] = True
            _save(todos)
            return todo
    return None
```

- [ ] **Step 3: Verify syntax**

Run: `cd /Users/liu/test/hermes-webui && python3 -c "import ast; ast.parse(open('backend/todo_store.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/todo_store.py
git commit -m "feat(reminder): extend todo store with deadline and reminded fields"
```

---

### Task 3: Backend — Add Reminder API Endpoints

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add import for `extract_deadline` at the companion import section**

After the existing `from companion import ...` line (~line 275), add:

```python
from todo_reminder import extract_deadline
```

- [ ] **Step 2: Modify the existing `POST /api/todos` endpoint to extract deadline**

Find the existing todo POST handler and update it to call `extract_deadline`. The current handler likely looks like:

```python
@app.post("/api/todos")
async def create_todo(req: dict):
    content = req.get("content", "")
    if not content:
        raise HTTPException(400, "content required")
    todo = todo_store.add_todo(content)
    return todo
```

Replace with:

```python
@app.post("/api/todos")
async def create_todo(req: dict):
    content = req.get("content", "")
    if not content:
        raise HTTPException(400, "content required")
    todo = todo_store.add_todo(content)
    # Extract deadline in background, update todo if found
    asyncio.create_task(_extract_and_set_deadline(todo["id"], content))
    return todo


async def _extract_and_set_deadline(todo_id: str, content: str):
    """Background task: extract deadline via LLM and update the todo."""
    try:
        deadline = await extract_deadline(content)
        if deadline:
            todo_store.update_todo(todo_id, deadline=deadline)
            print(f"[todo-reminder] Set deadline for '{content}': {deadline}")
    except Exception as e:
        print(f"[todo-reminder] Extraction failed: {e}")
```

- [ ] **Step 3: Update `todo_store.update_todo` to accept `deadline` parameter**

In `backend/todo_store.py`, update the `update_todo` function:

```python
def update_todo(todo_id: str, completed: bool | None = None, content: str | None = None, deadline: str | None = ...) -> dict | None:
    todos = _load()
    for todo in todos:
        if todo["id"] == todo_id:
            if completed is not None:
                todo["completed"] = completed
            if content is not None:
                todo["content"] = content
            if deadline is not ...:
                todo["deadline"] = deadline
            _save(todos)
            return todo
    return None
```

Note: Using `...` (Ellipsis) as default so `None` can be a valid value meaning "no deadline".

- [ ] **Step 4: Add reminder endpoints in `main.py`**

Add before the static files section (~line 340):

```python
@app.get("/api/todos/reminders")
async def todo_reminders():
    """Return todos due within 10 minutes that haven't been reminded."""
    return todo_store.get_pending_reminders(within_minutes=10)


@app.post("/api/todos/{todo_id}/reminded")
async def todo_mark_reminded(todo_id: str):
    """Mark a todo as reminded."""
    result = todo_store.mark_reminded(todo_id)
    if not result:
        raise HTTPException(404, "Todo not found")
    return result
```

- [ ] **Step 5: Verify syntax**

Run: `cd /Users/liu/test/hermes-webui && python3 -c "import ast; ast.parse(open('backend/main.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/todo_store.py
git commit -m "feat(reminder): add deadline extraction on todo create and reminder endpoints"
```

---

### Task 4: Frontend — Reminder Popup Page

**Files:**
- Create: `frontend/reminder.html`
- Create: `frontend/src/reminder/reminder-entry.tsx`
- Create: `frontend/src/reminder/ReminderApp.tsx`
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Create `frontend/reminder.html`**

```html
<!DOCTYPE html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hermes Reminder</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body, #reminder-root {
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <div id="reminder-root"></div>
    <script type="module" src="/src/reminder/reminder-entry.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `frontend/src/reminder/reminder-entry.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ReminderApp from "./ReminderApp";
import "../styles/global.css";

createRoot(document.getElementById("reminder-root")!).render(
  <StrictMode>
    <ReminderApp />
  </StrictMode>,
);
```

- [ ] **Step 3: Create `frontend/src/reminder/ReminderApp.tsx`**

```tsx
import { useState, useEffect } from "react";

interface ReminderData {
  id: string;
  content: string;
  deadline: string;
}

export default function ReminderApp() {
  const [reminder, setReminder] = useState<ReminderData | null>(null);

  useEffect(() => {
    const hd = (window as any).hermesDesktop;
    if (!hd?.onReminderData) return;
    hd.onReminderData((data: ReminderData) => {
      setReminder(data);
    });
  }, []);

  function dismiss() {
    const hd = (window as any).hermesDesktop;
    if (reminder) {
      hd?.dismissReminder?.(reminder.id);
    }
  }

  function formatTime(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  if (!reminder) return null;

  return (
    <div className="w-full h-full flex items-center justify-center p-3">
      <div className="w-full rounded-xl border border-cyan-400/20 bg-[#0a0e17]/95 backdrop-blur-xl shadow-[0_0_40px_rgba(34,211,238,0.15)] p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse" />
          <span className="text-[10px] font-mono text-cyan-400/70 tracking-wider">REMINDER</span>
          <span className="ml-auto text-[10px] font-mono text-cyan-300/60">{formatTime(reminder.deadline)}</span>
        </div>

        {/* Content */}
        <p className="text-sm font-sans text-white/90 leading-relaxed mb-4 break-words line-clamp-3">
          {reminder.content}
        </p>

        {/* Dismiss button */}
        <button
          onClick={dismiss}
          className="w-full py-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/5 text-xs font-mono text-cyan-300 hover:bg-cyan-400/15 hover:border-cyan-400/40 transition-colors"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add reminder entry to `frontend/vite.config.ts`**

Update the `input` section in `build.rollupOptions`:

```ts
input: {
  main: resolve(__dirname, "index.html"),
  companion: resolve(__dirname, "companion.html"),
  spotlight: resolve(__dirname, "spotlight.html"),
  reminder: resolve(__dirname, "reminder.html"),
},
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/liu/test/hermes-webui/frontend && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/reminder.html frontend/src/reminder/ frontend/vite.config.ts
git commit -m "feat(reminder): add reminder popup page with cyberpunk styling"
```

---

### Task 5: Electron — Reminder IPC and Preload

**Files:**
- Modify: `electron/preload.js`

- [ ] **Step 1: Add reminder IPC to `electron/preload.js`**

Add after the existing `spotlightExpand` line:

```javascript
  // Reminder
  onReminderData: (callback) => {
    ipcRenderer.on("reminder:data", (_event, data) => callback(data));
  },
  dismissReminder: (todoId) => ipcRenderer.send("reminder:dismiss", todoId),
```

- [ ] **Step 2: Commit**

```bash
git add electron/preload.js
git commit -m "feat(reminder): add reminder IPC to preload bridge"
```

---

### Task 6: Electron — Reminder Polling and Window Management

**Files:**
- Modify: `electron/main.js`

- [ ] **Step 1: Add reminder state variables**

After the existing `let companionIntervalMs = ...` line (~line 43), add:

```javascript
let reminderTimerId = null;
let reminderWindows = new Map(); // todoId -> BrowserWindow
```

- [ ] **Step 2: Add `createReminderWindow` function**

Add before the Spotlight Window section (~before `function createSpotlightWindow`):

```javascript
// ---------------------------------------------------------------------------
// Reminder Window (todo deadline popup)
// ---------------------------------------------------------------------------

function createReminderWindow(todo) {
  if (reminderWindows.has(todo.id)) return; // already showing

  const display = screen.getPrimaryDisplay();
  const { width: screenW } = display.workAreaSize;
  const winWidth = 300;
  const winHeight = 150;
  // Stack reminders vertically from top-right
  const offset = reminderWindows.size * (winHeight + 10);

  const win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: screenW - winWidth - 20,
    y: 40 + offset,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const reminderURL = `${BACKEND_URL}/reminder.html`;
  win.loadURL(reminderURL);
  win.setVisibleOnAllWorkspaces(true);

  // Send todo data once the page is ready
  win.webContents.on("did-finish-load", () => {
    win.webContents.send("reminder:data", {
      id: todo.id,
      content: todo.content,
      deadline: todo.deadline,
    });
  });

  win.on("closed", () => {
    reminderWindows.delete(todo.id);
  });

  reminderWindows.set(todo.id, win);
  console.log(`[reminder] Window created for: ${todo.content}`);
}
```

- [ ] **Step 3: Add reminder polling and dismiss handler**

Add right after the `createReminderWindow` function:

```javascript
async function pollReminders() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/todos/reminders`);
    if (!response.ok) return;
    const todos = await response.json();
    for (const todo of todos) {
      createReminderWindow(todo);
    }
  } catch (e) {
    // Backend may not be ready yet, ignore
  }
}

function startReminderPolling() {
  if (reminderTimerId) return;
  reminderTimerId = setInterval(pollReminders, 30000); // every 30s
  pollReminders(); // immediate first check
  console.log("[reminder] Polling started (30s interval)");
}

function stopReminderPolling() {
  if (reminderTimerId) {
    clearInterval(reminderTimerId);
    reminderTimerId = null;
  }
}
```

- [ ] **Step 4: Add dismiss IPC handler in `setupCompanionIPC`**

Inside the `setupCompanionIPC` function, add at the end (before the closing `}`):

```javascript
  // Reminder dismiss
  ipcMain.on("reminder:dismiss", async (_event, todoId) => {
    console.log(`[reminder] Dismissed: ${todoId}`);
    // Mark as reminded in backend
    try {
      await fetch(`${BACKEND_URL}/api/todos/${todoId}/reminded`, { method: "POST" });
    } catch (e) {
      console.error("[reminder] Failed to mark reminded:", e.message);
    }
    // Close the reminder window
    const win = reminderWindows.get(todoId);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    reminderWindows.delete(todoId);
  });
```

- [ ] **Step 5: Start reminder polling on app ready**

In the `app.on("ready", ...)` handler, after `createTray()` (~line 756), add:

```javascript
  startReminderPolling();
```

- [ ] **Step 6: Stop reminder polling on quit**

In the `app.on("before-quit", ...)` handler, after `stopBackend()`, add:

```javascript
  stopReminderPolling();
```

- [ ] **Step 7: Commit**

```bash
git add electron/main.js
git commit -m "feat(reminder): add reminder polling and popup window management"
```

---

### Task 7: Frontend — Show Deadline Badge in TodoPanel

**Files:**
- Modify: `frontend/src/components/TodoPanel.tsx`

- [ ] **Step 1: Add deadline display to `TodoItem` component**

Update the `TodoItem` component in `frontend/src/components/TodoPanel.tsx`. Replace the existing `TodoItem` function:

```tsx
function TodoItem({
  todo,
  onToggle,
  onRemove,
}: {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onRemove: (id: string) => void;
}) {
  function formatDeadline(iso: string) {
    try {
      const d = new Date(iso);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const time = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      if (isToday) return time;
      const month = d.getMonth() + 1;
      const day = d.getDate();
      return `${month}/${day} ${time}`;
    } catch {
      return "";
    }
  }

  const deadlineStr = todo.deadline ? formatDeadline(todo.deadline) : "";

  return (
    <div className="group flex items-center gap-2 py-1 text-xs font-mono">
      <button
        onClick={() => onToggle(todo.id, !todo.completed)}
        className={`w-3.5 h-3.5 border rounded-sm shrink-0 flex items-center justify-center transition-colors ${
          todo.completed
            ? "bg-cyber-accent/20 border-cyber-accent/40 text-cyber-accent"
            : "border-cyber-border hover:border-cyber-accent/40"
        }`}
      >
        {todo.completed && (
          <span className="text-[8px] leading-none">x</span>
        )}
      </button>
      <span
        className={`flex-1 ${todo.completed ? "text-cyber-muted line-through" : "text-cyber-text"}`}
      >
        {todo.content}
      </span>
      {deadlineStr && !todo.completed && (
        <span className="text-[9px] text-cyan-400/60 shrink-0">{deadlineStr}</span>
      )}
      <button
        onClick={() => onRemove(todo.id)}
        className="text-cyber-muted hover:text-cyber-error opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
      >
        DEL
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update `Todo` interface in `useTodos.ts`**

In `frontend/src/hooks/useTodos.ts`, add `deadline` and `reminded` to the interface:

```typescript
export interface Todo {
  id: string;
  content: string;
  completed: boolean;
  created_at?: string;
  deadline?: string | null;
  reminded?: boolean;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/liu/test/hermes-webui/frontend && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TodoPanel.tsx frontend/src/hooks/useTodos.ts
git commit -m "feat(reminder): show deadline badge on todo items"
```

---

### Task 8: Build and Verify

- [ ] **Step 1: Build frontend**

Run: `cd /Users/liu/test/hermes-webui/frontend && npm run build`
Expected: Build succeeds, `reminder.html` appears in `dist/`

- [ ] **Step 2: Verify reminder.html is in dist**

Run: `ls /Users/liu/test/hermes-webui/frontend/dist/reminder.html`
Expected: File exists

- [ ] **Step 3: Verify backend syntax**

Run: `cd /Users/liu/test/hermes-webui && python3 -c "import ast; [ast.parse(open(f'backend/{f}').read()) for f in ['todo_store.py','todo_reminder.py','main.py']]; print('All OK')"`
Expected: `All OK`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(reminder): todo deadline reminder system complete"
```
