import { useSystemInfo } from "../hooks/useSystemInfo";

export default function SystemBar({ chatConnected }: { chatConnected: boolean }) {
  const info = useSystemInfo();

  return (
    <header className="h-10 flex items-center justify-between px-4 border-b border-cyber-border bg-cyber-panel shrink-0">
      <div className="flex items-center gap-3">
        <img src="/hermes-logo-mono.png" alt="Hermes" className="h-6 opacity-80" />
        <span className="text-cyber-muted text-xs">
          {info ? `v${info.hermes_version}` : "..."}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-cyber-muted font-mono">
        {info && (
          <>
            <span title="Model">{info.model}</span>
            <span className="text-cyber-border">|</span>
            <span title="CPU">{info.cpu}</span>
            <span className="text-cyber-border">|</span>
            <span title="Memory">{info.memory}</span>
            <span className="text-cyber-border">|</span>
            <span title="Runtime">{info.runtime}</span>
          </>
        )}
        <span className="text-cyber-border">|</span>
        <span className={chatConnected ? "text-cyber-accent" : "text-cyber-error"}>
          {chatConnected ? "ONLINE" : "OFFLINE"}
        </span>
      </div>
    </header>
  );
}
