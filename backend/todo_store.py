import json
import uuid
from datetime import datetime
from pathlib import Path
from config import DATA_DIR

TODOS_FILE = DATA_DIR / "todos.json"


def _load() -> list[dict]:
    if not TODOS_FILE.exists():
        return []
    try:
        return json.loads(TODOS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def _save(todos: list[dict]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    TODOS_FILE.write_text(
        json.dumps(todos, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def list_todos() -> list[dict]:
    return _load()


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


def delete_todo(todo_id: str) -> bool:
    todos = _load()
    new_todos = [t for t in todos if t["id"] != todo_id]
    if len(new_todos) == len(todos):
        return False
    _save(new_todos)
    return True


def reorder_todos(ordered_ids: list[str]) -> list[dict]:
    todos = _load()
    by_id = {t["id"]: t for t in todos}
    reordered = [by_id[tid] for tid in ordered_ids if tid in by_id]
    seen = set(ordered_ids)
    for t in todos:
        if t["id"] not in seen:
            reordered.append(t)
    _save(reordered)
    return reordered


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
