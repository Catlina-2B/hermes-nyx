import sys
import os
import json
import asyncio

HERMES_AGENT_DIR = os.path.expanduser("~/.hermes/hermes-agent")
if HERMES_AGENT_DIR not in sys.path:
    sys.path.insert(0, HERMES_AGENT_DIR)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path

from chat_manager import ChatManager
from log_monitor import LogMonitor
from system_info import get_system_info
import todo_store

app = FastAPI(title="Hermes WebUI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

chat_manager = ChatManager()
log_monitor = LogMonitor()


# ── REST: Health ──────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ── REST: Chat History ───────────────────────────────────

@app.get("/api/chat/history")
async def chat_history():
    return chat_manager.get_chat_messages()

@app.get("/api/chat/sessions")
async def chat_sessions():
    return chat_manager.list_sessions()

@app.post("/api/chat/sessions/new")
async def new_session():
    sid = chat_manager.new_session()
    return {"session_id": sid}

@app.post("/api/chat/sessions/{session_id}/switch")
async def switch_session(session_id: str):
    ok = chat_manager.switch_session(session_id)
    if ok:
        return {"ok": True, "session_id": session_id}
    return {"error": "session not found"}


# ── REST: System Info ─────────────────────────────────────

@app.get("/api/system/info")
async def system_info():
    return get_system_info()


# ── REST: Todos ───────────────────────────────────────────

class TodoCreate(BaseModel):
    content: str

class TodoUpdate(BaseModel):
    completed: bool | None = None
    content: str | None = None

class TodoReorder(BaseModel):
    ordered_ids: list[str]

@app.get("/api/todos")
async def get_todos():
    return todo_store.list_todos()

@app.post("/api/todos")
async def create_todo(body: TodoCreate):
    return todo_store.add_todo(body.content)

@app.patch("/api/todos/{todo_id}")
async def update_todo(todo_id: str, body: TodoUpdate):
    result = todo_store.update_todo(todo_id, body.completed, body.content)
    if result is None:
        return {"error": "not found"}
    return result

@app.delete("/api/todos/{todo_id}")
async def delete_todo(todo_id: str):
    if todo_store.delete_todo(todo_id):
        return {"ok": True}
    return {"error": "not found"}

@app.post("/api/todos/reorder")
async def reorder_todos(body: TodoReorder):
    return todo_store.reorder_todos(body.ordered_ids)


# ── REST: Quick Chat (for Spotlight) ──────────────────────

class QuickChatRequest(BaseModel):
    content: str


from fastapi.responses import StreamingResponse


@app.post("/api/chat/quick")
async def quick_chat(req: QuickChatRequest):
    """Simple streaming POST endpoint for Spotlight input."""
    async def event_stream():
        async for event in chat_manager.send_message(req.content):
            yield f"data: {json.dumps(event)}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ── WebSocket: Chat (WS1) ────────────────────────────────

@app.websocket("/ws/chat")
async def ws_chat(ws: WebSocket):
    await ws.accept()
    send_task: asyncio.Task | None = None

    async def do_send(content: str):
        try:
            async for event in chat_manager.send_message(content):
                await ws.send_json(event)
        except Exception as e:
            try:
                await ws.send_json({"type": "error", "message": str(e)})
            except Exception:
                pass

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)

            if msg.get("type") == "interrupt":
                chat_manager.interrupt()
                if send_task and not send_task.done():
                    send_task.cancel()
                    try:
                        await send_task
                    except asyncio.CancelledError:
                        pass
                await ws.send_json({"type": "interrupted"})
                continue

            if msg.get("type") == "reset":
                if send_task and not send_task.done():
                    send_task.cancel()
                    try:
                        await send_task
                    except asyncio.CancelledError:
                        pass
                new_sid = chat_manager.new_session()
                await ws.send_json({"type": "session_reset", "session_id": new_sid})
                continue

            if msg.get("type") == "send":
                content = msg.get("content", "")
                send_task = asyncio.create_task(do_send(content))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        if send_task and not send_task.done():
            send_task.cancel()


# ── WebSocket: Logs (WS2) ────────────────────────────────

@app.websocket("/ws/logs")
async def ws_logs(ws: WebSocket):
    await ws.accept()

    raw_task: asyncio.Task | None = None
    summary_task: asyncio.Task | None = None

    async def stream_raw():
        try:
            async for event in log_monitor.stream_raw_logs():
                await ws.send_json(event)
        except asyncio.CancelledError:
            pass

    async def stream_summary():
        try:
            async for event in log_monitor.stream_summaries():
                await ws.send_json(event)
        except asyncio.CancelledError:
            pass

    try:
        raw_task = asyncio.create_task(stream_raw())

        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)

            if msg.get("type") == "subscribe":
                mode = msg.get("mode")
                if mode == "raw":
                    if raw_task is None or raw_task.done():
                        raw_task = asyncio.create_task(stream_raw())
                elif mode == "summary":
                    if summary_task is None or summary_task.done():
                        summary_task = asyncio.create_task(stream_summary())

            elif msg.get("type") == "set_model":
                model = msg.get("model", "")
                base_url = msg.get("base_url")
                api_key = msg.get("api_key")
                log_monitor.set_summary_model(model, base_url, api_key)
                if summary_task and not summary_task.done():
                    summary_task.cancel()
                summary_task = asyncio.create_task(stream_summary())

    except WebSocketDisconnect:
        pass
    finally:
        if raw_task and not raw_task.done():
            raw_task.cancel()
        if summary_task and not summary_task.done():
            summary_task.cancel()


# ── Companion API ────────────────────────────────────────

from companion import analyze_screenshot, analyze_with_question, get_analysis_history


class ScreenshotRequest(BaseModel):
    image: str  # base64 encoded PNG


class CompanionStatusResponse(BaseModel):
    enabled: bool
    interval_minutes: int


_companion_enabled = False
_companion_interval = 5


@app.post("/api/companion/analyze")
async def companion_analyze(req: ScreenshotRequest):
    result = await analyze_screenshot(req.image, chat_manager=chat_manager)

    # Auto-create todos if AI detected any
    if result.get("todos"):
        for todo_text in result["todos"]:
            if todo_text and isinstance(todo_text, str):
                todo_store.add_todo(todo_text.strip())

    return result


class ContextAnalyzeRequest(BaseModel):
    image: str
    question: str


@app.post("/api/companion/ask")
async def companion_ask(req: ContextAnalyzeRequest):
    """Answer a question about what's on screen (for Spotlight)."""
    answer = await analyze_with_question(req.image, req.question)
    return {"answer": answer}


@app.get("/api/companion/status")
async def companion_status():
    return {"enabled": _companion_enabled, "interval_minutes": _companion_interval}


@app.post("/api/companion/toggle")
async def companion_toggle():
    global _companion_enabled
    _companion_enabled = not _companion_enabled
    return {"enabled": _companion_enabled}


@app.get("/api/companion/history")
async def companion_history():
    return get_analysis_history()


@app.post("/api/companion/interval")
async def companion_set_interval(minutes: int = 5):
    global _companion_interval
    _companion_interval = max(1, min(30, minutes))
    return {"interval_minutes": _companion_interval}


# ── Static Files (production) ────────────────────────────

_dist_env = os.environ.get("HERMES_FRONTEND_DIST")
DIST_DIR = Path(_dist_env) if _dist_env else Path(__file__).parent.parent / "frontend" / "dist"
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = DIST_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(DIST_DIR / "index.html")
