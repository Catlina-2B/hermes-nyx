import { useState, useEffect, useCallback, useRef } from "react";

export interface Todo {
  id: string;
  content: string;
  completed: boolean;
  created_at?: string;
  deadline?: string | null;
  reminded?: boolean;
}

const API = "/api/todos";

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(API);
      if (res.ok) setTodos(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
    // Poll every 3 seconds to pick up agent todo changes
    timerRef.current = setInterval(refresh, 3000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh]);

  const add = useCallback(
    async (content: string) => {
      await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      await refresh();
    },
    [refresh],
  );

  const toggle = useCallback(
    async (id: string, completed: boolean) => {
      await fetch(`${API}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await fetch(`${API}/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh],
  );

  return { todos, add, toggle, remove, refresh };
}
