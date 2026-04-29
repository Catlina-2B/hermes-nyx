import sys
import os
import asyncio
import json
import queue
import threading
import uuid
from pathlib import Path
from typing import AsyncGenerator

from todo_reminder import extract_deadline

_BACKEND_DIR = str(Path(__file__).parent)
HERMES_AGENT_DIR = os.path.expanduser("~/.hermes/hermes-agent")
if HERMES_AGENT_DIR not in sys.path:
    sys.path.insert(0, HERMES_AGENT_DIR)
# Ensure local backend dir takes priority over hermes-agent for 'plugins' etc.
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from config import load_hermes_config, set_model_name, DATA_DIR
from hermes_state import SessionDB
from tools.todo_tool import TodoStore
from plugins.vrm_digital_human import VRM_DIGITAL_HUMAN_PROMPT

SESSION_FILE = DATA_DIR / "current_session.json"
TODOS_FILE = DATA_DIR / "todos.json"
_db = SessionDB()  # uses ~/.hermes/state.db


class PersistentTodoStore(TodoStore):
    """TodoStore that persists to a JSON file, shared between agent and WebUI."""

    def __init__(self, path: Path):
        super().__init__()
        self._path = path
        self._load_from_file()

    def _load_from_file(self) -> None:
        if self._path.exists():
            try:
                data = json.loads(self._path.read_text(encoding="utf-8"))
                self._items = data if isinstance(data, list) else []
            except Exception:
                self._items = []

    def _save_to_file(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(self._items, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def write(self, todos, merge=False):
        self._load_from_file()  # reload in case WebUI modified it
        old_ids = {item.get("id") for item in self._items}
        result = super().write(todos, merge)
        self._save_to_file()
        # Trigger deadline extraction for newly added todos (never block write)
        try:
            for item in self._items:
                if item.get("id") not in old_ids and item.get("content"):
                    self._extract_deadline_async(item)
        except Exception as e:
            print(f"[todo-reminder] Deadline hook error (non-fatal): {e}")
        return result

    def _extract_deadline_async(self, item: dict) -> None:
        """Fire-and-forget deadline extraction for a new todo item."""
        import todo_store as ts

        async def _do_extract():
            try:
                deadline = await extract_deadline(item.get("content", ""))
                if deadline:
                    ts.update_todo(item["id"], deadline=deadline)
                    print(f"[todo-reminder] Agent todo deadline: {deadline}")
            except Exception as e:
                print(f"[todo-reminder] Agent todo extraction failed: {e}")

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(_do_extract())
            else:
                asyncio.run(_do_extract())
        except RuntimeError:
            pass

    def read(self):
        self._load_from_file()
        return super().read()


_shared_todo_store = PersistentTodoStore(TODOS_FILE)


def _save_session_id(session_id: str) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SESSION_FILE.write_text(
        json.dumps({"session_id": session_id}), encoding="utf-8"
    )


def _load_session_id() -> str | None:
    if not SESSION_FILE.exists():
        return None
    try:
        return json.loads(SESSION_FILE.read_text(encoding="utf-8")).get("session_id")
    except Exception:
        return None


def _load_history_from_db(session_id: str) -> list[dict]:
    """Load conversation messages from Hermes state.db."""
    return _db.get_messages_as_conversation(session_id)


def _history_to_chat_messages(history: list[dict]) -> list[dict]:
    """Convert agent message history to frontend ChatMessage format."""
    result = []
    for msg in history:
        role = msg.get("role")
        if role == "user":
            content = msg.get("content", "")
            if isinstance(content, list):
                content = " ".join(
                    p.get("text", "") for p in content if p.get("type") == "text"
                )
            if content:
                result.append({"role": "user", "content": content})
        elif role == "assistant":
            content = msg.get("content", "") or ""
            tool_calls_raw = msg.get("tool_calls") or []
            tool_calls = []
            for tc in tool_calls_raw:
                fn = tc.get("function", {})
                tool_calls.append({
                    "name": fn.get("name", ""),
                    "args": fn.get("arguments", ""),
                    "preview": fn.get("name", ""),
                })
            if content or tool_calls:
                entry: dict = {"role": "assistant", "content": content}
                if tool_calls:
                    entry["toolCalls"] = tool_calls
                result.append(entry)
    return result


class ChatManager:
    """Wraps Hermes AIAgent for WebSocket-based chat."""

    def __init__(self):
        self._agent = None
        self._agent_lock = threading.Lock()
        self._session_id: str | None = None
        self._conversation_history: list[dict] | None = None

        # Restore previous session
        prev_id = _load_session_id()
        if prev_id:
            history = _load_history_from_db(prev_id)
            if history:
                self._session_id = prev_id
                self._conversation_history = history

    def _ensure_agent(self) -> None:
        if self._agent is not None:
            return

        from run_agent import AIAgent

        config = load_hermes_config()
        model_cfg = config.get("model", {})
        agent_cfg = config.get("agent", {})

        if not self._session_id:
            self._session_id = f"webui_{uuid.uuid4().hex[:12]}"

        self._agent = AIAgent(
            model=model_cfg.get("default", ""),
            base_url=model_cfg.get("base_url"),
            api_key=os.environ.get("OPENAI_API_KEY") or model_cfg.get("api_key"),
            provider=model_cfg.get("provider"),
            max_iterations=agent_cfg.get("max_turns", 60),
            quiet_mode=True,
            verbose_logging=False,
            ephemeral_system_prompt=VRM_DIGITAL_HUMAN_PROMPT,
            platform="web_ui",
            session_id=self._session_id,
            session_db=_db,
        )

        # Replace agent's in-memory TodoStore with our persistent one
        self._agent._todo_store = _shared_todo_store

        _save_session_id(self._session_id)

    def get_chat_messages(self) -> list[dict]:
        """Return frontend-formatted chat messages from persisted history."""
        # Try live agent first, fall back to DB
        if self._agent and hasattr(self._agent, "_session_messages"):
            msgs = self._agent._session_messages
            if msgs:
                return _history_to_chat_messages(msgs)
        if self._conversation_history:
            return _history_to_chat_messages(self._conversation_history)
        return []

    async def send_message(self, content: str | list) -> AsyncGenerator[dict, None]:
        self._ensure_agent()

        event_queue: queue.Queue = queue.Queue()
        history = self._conversation_history

        def on_stream_delta(delta):
            if delta is not None:
                event_queue.put({"type": "chunk", "content": delta})

        def on_tool_progress(event_type, name, preview, args, **kwargs):
            if event_type == "tool.started":
                event_queue.put({
                    "type": "tool_call",
                    "name": name,
                    "args": str(args) if args else "",
                    "preview": preview or name,
                })

        def on_tool_complete(name, result, duration):
            result_str = str(result) if result else ""
            if len(result_str) > 2000:
                result_str = result_str[:2000] + "..."
            event_queue.put({
                "type": "tool_result",
                "name": name,
                "result": result_str,
                "duration": round(duration, 2) if duration else 0,
            })

        self._agent.tool_progress_callback = on_tool_progress
        self._agent.tool_complete_callback = on_tool_complete

        loop = asyncio.get_event_loop()
        done_event = asyncio.Event()

        def run_agent():
            try:
                actual_content = content
                if isinstance(content, list):
                    # Follow Hermes CLI approach: pre-analyze images via vision tool,
                    # prepend descriptions to user text as plain string.
                    print("[chat] Processing multimodal content with vision tool...")
                    try:
                        actual_content = self._preprocess_images(content)
                        print(f"[chat] Vision preprocessing done: {actual_content[:100]}...")
                    except Exception as ve:
                        print(f"[chat] Vision preprocessing failed: {ve}")
                        # Fallback: just send the text without image
                        text_parts = [p["text"] for p in content if p.get("type") == "text"]
                        actual_content = " ".join(text_parts) or "（图片处理失败）"
                result = self._agent.run_conversation(
                    user_message=actual_content,
                    conversation_history=history,
                    stream_callback=on_stream_delta,
                )
                # Carry the resulting message list into the next turn — the
                # agent does not read its own _session_messages back into
                # run_conversation, so without this the next call starts
                # with an empty history and forgets prior context.
                updated = result.get("messages") if isinstance(result, dict) else None
                if isinstance(updated, list) and updated:
                    self._conversation_history = list(updated)
                event_queue.put({
                    "type": "done",
                    "session_id": self._session_id,
                    "final_response": result.get("final_response", ""),
                })
            except Exception as e:
                event_queue.put({"type": "error", "message": str(e)})
            finally:
                event_queue.put(None)
                loop.call_soon_threadsafe(done_event.set)

        thread = threading.Thread(target=run_agent, daemon=True)
        thread.start()

        while True:
            try:
                event = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: event_queue.get(timeout=0.1)
                )
            except queue.Empty:
                if done_event.is_set():
                    while not event_queue.empty():
                        event = event_queue.get_nowait()
                        if event is not None:
                            yield event
                    break
                continue

            if event is None:
                break
            yield event

    def list_sessions(self, limit: int = 20) -> list[dict]:
        """List recent WebUI sessions from DB."""
        import sqlite3
        try:
            conn = _db._conn
            cursor = conn.execute(
                "SELECT id, title, message_count, started_at "
                "FROM sessions WHERE source = 'web_ui' "
                "ORDER BY started_at DESC LIMIT ?",
                (limit,),
            )
            return [
                {
                    "id": row["id"],
                    "title": row["title"] or row["id"],
                    "message_count": row["message_count"] or 0,
                    "started_at": row["started_at"],
                }
                for row in cursor.fetchall()
            ]
        except Exception:
            return []

    def switch_session(self, session_id: str) -> bool:
        """Switch to an existing session."""
        history = _load_history_from_db(session_id)
        if not history:
            return False
        self._agent = None
        self._session_id = session_id
        self._conversation_history = history
        _save_session_id(session_id)
        return True

    def new_session(self) -> str:
        """Create a brand new session."""
        self._agent = None
        self._session_id = None
        self._conversation_history = None
        self._ensure_agent()
        return self._session_id

    def get_agent_todos(self) -> list[dict]:
        if self._agent is None:
            return []
        store = getattr(self._agent, "_todo_store", None)
        if store is None:
            return []
        return store.read()

    def _preprocess_images(self, content: list) -> str:
        """Analyze images via vision tool and return enriched text (same as Hermes CLI)."""
        import base64
        import tempfile
        import asyncio as _asyncio
        import json as _json

        text_parts = [p["text"] for p in content if p.get("type") == "text"]
        user_text = " ".join(text_parts) or ""

        enriched_parts = []
        for part in content:
            if part.get("type") != "image_url":
                continue
            url = part.get("image_url", {}).get("url", "")
            if not url.startswith("data:"):
                continue
            # Save base64 image to temp file
            b64_data = url.split(",", 1)[-1]
            img_bytes = base64.b64decode(b64_data)
            images_dir = Path.home() / ".hermes" / "images"
            images_dir.mkdir(parents=True, exist_ok=True)
            tmp = tempfile.NamedTemporaryFile(suffix=".png", dir=str(images_dir), delete=False)
            tmp.write(img_bytes)
            tmp.close()
            img_path = tmp.name

            try:
                from tools.vision_tools import vision_analyze_tool
                analysis_prompt = (
                    "Describe everything visible in this image in thorough detail. "
                    "Include any text, code, data, objects, people, layout, colors, "
                    "and any other notable visual information."
                )
                result_json = _asyncio.run(
                    vision_analyze_tool(image_url=img_path, user_prompt=analysis_prompt)
                )
                result = _json.loads(result_json)
                if result.get("success"):
                    description = result.get("analysis", "")
                    enriched_parts.append(
                        f"[The user attached an image. Here's what it contains:\n{description}]\n"
                        f"[If you need a closer look, use vision_analyze with "
                        f"image_url: {img_path}]"
                    )
                else:
                    enriched_parts.append(
                        f"[The user attached an image but it couldn't be analyzed. "
                        f"You can try examining it with vision_analyze using "
                        f"image_url: {img_path}]"
                    )
            except Exception as e:
                enriched_parts.append(
                    f"[The user attached an image but analysis failed ({e}). "
                    f"You can try examining it with vision_analyze using "
                    f"image_url: {img_path}]"
                )
                print(f"[chat] Vision analysis error: {e}")

        if enriched_parts:
            prefix = "\n\n".join(enriched_parts)
            return f"{prefix}\n\n{user_text}" if user_text else prefix
        return user_text or "请描述这张图片"

    def interrupt(self) -> None:
        if self._agent is not None:
            self._agent.interrupt()

    def set_model(self, model: str) -> str:
        """Switch the default model for future chat turns."""
        set_model_name(model)
        if self._agent is not None:
            self._agent.interrupt()
        self._agent = None
        return model

    def reset_session(self) -> str:
        self._agent = None
        self._session_id = None
        self._conversation_history = None
        self._ensure_agent()
        return self._session_id
