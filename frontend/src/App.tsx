import { useRef } from "react";
import { useChat } from "./hooks/useChat";
import { useLogs } from "./hooks/useLogs";
import { useTodos } from "./hooks/useTodos";
import { useDock, type DockPosition } from "./hooks/useDock";
import SystemBar from "./components/SystemBar";
import ChatPanel from "./components/ChatPanel";
import LogPanel from "./components/LogPanel";
import TodoPanel from "./components/TodoPanel";
import DropZone from "./components/DropZone";
import DigitalHumanPanel from "./plugins/vrm-digital-human/DigitalHumanPanel";
import { frontendPlugins } from "./plugins/registry";
import type { ChatDirectiveHandler } from "./plugins/types";

export default function App() {
  const chatDirectiveRef = useRef<ChatDirectiveHandler | null>(null);
  const pluginContext = { chatDirectiveRef };
  const chat = useChat(chatDirectiveRef);
  const logs = useLogs();
  const { todos, add, toggle, remove } = useTodos();
  const { position, dragging, setDragging, moveTo } = useDock();

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", "avatar-panel");
    e.dataTransfer.effectAllowed = "move";
    // Defer so the drag ghost renders before we change layout
    setTimeout(() => setDragging(true), 0);
  };

  const handleDragEnd = () => setDragging(false);

  /** The avatar panel wrapped with a drag handle */
  const avatarPanel = (cls: string) => (
    <div className={`relative group ${cls}`}>
      {/* Invisible drag handle zone at top */}
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className="absolute inset-x-0 top-0 z-40 h-10 cursor-grab active:cursor-grabbing"
      >
        {/* Grip dots — visible on hover */}
        <div className="absolute left-1/2 -translate-x-1/2 top-3 flex items-center gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="block w-[3px] h-[3px] rounded-full bg-cyan-300/60" />
          ))}
        </div>
      </div>
      <DigitalHumanPanel expressionCallbackRef={chatDirectiveRef} />
    </div>
  );

  /** Render either the panel (if docked here) or a drop zone (if dragging) */
  const dockSlot = (
    id: DockPosition,
    panelCls: string,
    zoneOpts?: { vertical?: boolean; label?: string },
  ) => {
    if (position === id) return avatarPanel(panelCls);
    if (dragging) return <DropZone onDrop={() => moveTo(id)} {...zoneOpts} />;
    return null;
  };

  // Other plugins that aren't the dockable VRM panel
  const otherPlugins = frontendPlugins.filter((p) => p.id !== "vrm-digital-human");

  return (
    <div className="h-screen flex flex-col bg-cyber-bg">
      <SystemBar chatConnected={chat.connected} />

      <div className="flex-1 flex overflow-hidden">
        {/* Dock: main-left */}
        {dockSlot("main-left", "w-80 shrink-0 border-r border-cyber-border", { vertical: true })}

        {/* Main chat area */}
        <main className="flex-1 min-w-0 border-r border-cyber-border">
          <ChatPanel
            messages={chat.messages}
            streaming={chat.streaming}
            sessions={chat.sessions}
            onSend={chat.send}
            onInterrupt={chat.interrupt}
            onNewSession={chat.newSession}
            onSwitchSession={chat.switchSession}
          />
        </main>

        {/* Right sidebar */}
        <aside className="w-80 shrink-0 flex flex-col bg-cyber-panel">
          {/* Dock: sidebar-top */}
          {dockSlot("sidebar-top", "shrink-0 h-[440px] border-b border-cyber-border")}

          {/* Logs */}
          <div className="flex-1 min-h-0 border-b border-cyber-border">
            <LogPanel
              rawLogs={logs.rawLogs}
              summaries={logs.summaries}
              connected={logs.connected}
            />
          </div>

          {/* Dock: sidebar-mid */}
          {dockSlot("sidebar-mid", "shrink-0 h-[440px] border-b border-cyber-border")}

          {/* Todos */}
          <div className="h-44 shrink-0 border-b border-cyber-border">
            <TodoPanel
              todos={todos}
              onAdd={add}
              onToggle={toggle}
              onRemove={remove}
            />
          </div>

          {/* Dock: sidebar-bottom (default) */}
          {dockSlot("sidebar-bottom", "shrink-0 h-[440px]")}

          {/* Other sidebar-bottom plugins */}
          {otherPlugins.map((plugin) =>
            plugin.renderSidebarBottom ? (
              <div key={plugin.id} className="shrink-0">
                {plugin.renderSidebarBottom(pluginContext)}
              </div>
            ) : null,
          )}
        </aside>
      </div>

      {/* Dock: main-bottom */}
      {dockSlot("main-bottom", "shrink-0 h-[280px] border-t border-cyber-border")}

      {/* Plugin overlays */}
      {frontendPlugins.map((plugin) =>
        plugin.renderOverlay ? (
          <div key={plugin.id}>{plugin.renderOverlay(pluginContext)}</div>
        ) : null,
      )}
    </div>
  );
}
