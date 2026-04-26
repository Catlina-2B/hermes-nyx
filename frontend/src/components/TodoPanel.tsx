import { useState } from "react";
import type { Todo } from "../hooks/useTodos";

interface Props {
  todos: Todo[];
  onAdd: (content: string) => void;
  onToggle: (id: string, completed: boolean) => void;
  onRemove: (id: string) => void;
}

export default function TodoPanel({ todos, onAdd, onToggle, onRemove }: Props) {
  const [input, setInput] = useState("");

  function handleAdd() {
    if (!input.trim()) return;
    onAdd(input.trim());
    setInput("");
  }

  const pending = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-cyber-border">
        <span className="text-xs font-mono text-cyber-muted">
          TODO ({pending.length}/{todos.length})
        </span>
      </div>

      {/* Add input */}
      <div className="shrink-0 flex gap-1.5 px-3 py-2 border-b border-cyber-border">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="新任务..."
          className="flex-1 bg-transparent text-xs font-mono text-cyber-text placeholder:text-cyber-muted/50 focus:outline-none"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="text-[10px] font-mono text-cyber-accent hover:text-cyber-accent/80 disabled:opacity-30"
        >
          +ADD
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {pending.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={onToggle}
            onRemove={onRemove}
          />
        ))}
        {done.length > 0 && (
          <>
            <div className="text-[10px] font-mono text-cyber-muted/50 pt-2">
              COMPLETED
            </div>
            {done.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={onToggle}
                onRemove={onRemove}
              />
            ))}
          </>
        )}
        {todos.length === 0 && (
          <p className="text-cyber-muted text-xs text-center mt-4 font-mono">
            // 暂无任务
          </p>
        )}
      </div>
    </div>
  );
}

function TodoItem({
  todo,
  onToggle,
  onRemove,
}: {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onRemove: (id: string) => void;
}) {
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
      <button
        onClick={() => onRemove(todo.id)}
        className="text-cyber-muted hover:text-cyber-error opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
      >
        DEL
      </button>
    </div>
  );
}
