import { useSystemInfo } from "../hooks/useSystemInfo";

export default function SystemBar({ chatConnected }: { chatConnected: boolean }) {
  const info = useSystemInfo();

  return (
    <header
      className="h-12 flex items-center justify-between px-4 border-b border-cyan-400/10 bg-cyber-panel shrink-0 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left: spacer for macOS traffic lights + branding */}
      <div className="flex items-center gap-3 pl-16">
        {/* Cyber accent line */}
        <div className="w-1 h-5 bg-gradient-to-b from-cyan-400 to-cyan-400/0 rounded-full" />
        <span className="text-cyan-300 font-mono font-bold text-sm tracking-[0.2em] glow-text">
          HERMES
        </span>
        <span className="text-cyan-400/30 text-xs font-mono">
          {info ? `v${info.hermes_version}` : ""}
        </span>
        {/* Decorative dots */}
        <div className="flex gap-1 ml-2">
          <span className="w-1 h-1 rounded-full bg-cyan-400/40" />
          <span className="w-1 h-1 rounded-full bg-cyan-400/25" />
          <span className="w-1 h-1 rounded-full bg-cyan-400/15" />
        </div>
      </div>

      {/* Right: system info + status */}
      <div
        className="flex items-center gap-3 text-[10px] text-cyber-muted font-mono"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {info && (
          <>
            <span className="text-cyan-400/40">{info.model}</span>
            <span className="w-px h-3 bg-cyan-400/15" />
            <span>{info.cpu}</span>
            <span className="w-px h-3 bg-cyan-400/15" />
            <span>{info.memory}</span>
            <span className="w-px h-3 bg-cyan-400/15" />
            <span>{info.runtime}</span>
          </>
        )}
        <span className="w-px h-3 bg-cyan-400/15" />
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${chatConnected
            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
            : "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]"
          }`} />
          <span className={chatConnected ? "text-emerald-400/80" : "text-red-400/80"}>
            {chatConnected ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
      </div>
    </header>
  );
}
