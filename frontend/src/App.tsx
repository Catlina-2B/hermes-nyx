import { useRef, useCallback } from "react";
import { useChat } from "./hooks/useChat";
import { useLogs } from "./hooks/useLogs";
import { useTodos } from "./hooks/useTodos";
import { useGridLayout } from "./hooks/useGridLayout";
import SystemBar from "./components/SystemBar";
import ChatPanel from "./components/ChatPanel";
import LogPanel from "./components/LogPanel";
import TodoPanel from "./components/TodoPanel";
import DashboardGrid, { type DragEvent } from "./components/DashboardGrid";
import DragEffectsCanvas, { type DragEffectsHandle } from "./components/DragEffectsCanvas";
import DigitalHumanPanel from "./plugins/vrm-digital-human/DigitalHumanPanel";
import { frontendPlugins } from "./plugins/registry";
import type { ChatDirectiveHandler } from "./plugins/types";

export default function App() {
  const chatDirectiveRef = useRef<ChatDirectiveHandler | null>(null);
  const chat = useChat(chatDirectiveRef);
  const logs = useLogs();
  const { todos, add, toggle, remove } = useTodos();
  const grid = useGridLayout();
  const effectsRef = useRef<DragEffectsHandle>(null);

  const handleDragEvent = useCallback((event: DragEvent) => {
    effectsRef.current?.onDragEvent(event);
  }, []);

  const gridChildren = [
    {
      key: "chat",
      node: (
        <ChatPanel
          messages={chat.messages}
          streaming={chat.streaming}
          sessions={chat.sessions}
          onSend={chat.send}
          onInterrupt={chat.interrupt}
          onNewSession={chat.newSession}
          onSwitchSession={chat.switchSession}
        />
      ),
    },
    {
      key: "log",
      node: (
        <LogPanel
          rawLogs={logs.rawLogs}
          summaries={logs.summaries}
          connected={logs.connected}
        />
      ),
    },
    {
      key: "todo",
      node: (
        <TodoPanel
          todos={todos}
          onAdd={add}
          onToggle={toggle}
          onRemove={remove}
        />
      ),
    },
    {
      key: "avatar",
      node: (
        <div className="relative h-full w-full">
          {/* Drag handle — visible on hover */}
          <div className="drag-handle absolute inset-x-0 top-0 z-40 h-9 cursor-grab active:cursor-grabbing group">
            <div className="absolute left-1/2 -translate-x-1/2 top-3 flex items-center gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className="block w-[3px] h-[3px] rounded-full bg-cyan-300/60" />
              ))}
            </div>
          </div>
          <DigitalHumanPanel expressionCallbackRef={chatDirectiveRef} />
        </div>
      ),
    },
  ];

  return (
    <div className="h-screen flex flex-col bg-cyber-bg">
      <SystemBar chatConnected={chat.connected} />

      <DashboardGrid
        layout={grid.layout}
        rowHeight={grid.rowHeight}
        cols={grid.cols}
        gap={grid.gap}
        onLayoutChange={grid.onLayoutChange}
        onDragEvent={handleDragEvent}
      >
        {gridChildren}
      </DashboardGrid>

      {/* Plugin overlays */}
      {frontendPlugins.map((plugin) =>
        plugin.renderOverlay ? (
          <div key={plugin.id}>{plugin.renderOverlay({ chatDirectiveRef })}</div>
        ) : null,
      )}

      <DragEffectsCanvas ref={effectsRef} />
    </div>
  );
}
