import { useEffect, useState } from "react";
import { useSystemInfo } from "../hooks/useSystemInfo";
import type { AvatarModelOption } from "../plugins/vrm-digital-human/model-options";

export default function SystemBar({
  chatConnected,
  chatStreaming,
  avatarModelPath,
  avatarModelOptions,
  onAvatarModelChange,
}: {
  chatConnected: boolean;
  chatStreaming: boolean;
  avatarModelPath: string;
  avatarModelOptions: AvatarModelOption[];
  onAvatarModelChange: (modelPath: string) => void;
}) {
  const info = useSystemInfo();
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [savingModel, setSavingModel] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadModels() {
      try {
        const res = await fetch("/api/models");
        if (!res.ok || !active) return;
        const data = await res.json() as { current?: string; options?: string[] };
        setModels(data.options ?? []);
        setSelectedModel(data.current ?? "");
      } catch {
        /* ignore */
      }
    }

    loadModels();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedModel && info?.model) {
      setSelectedModel(info.model);
    }
  }, [info?.model, selectedModel]);

  async function onModelChange(nextModel: string) {
    const previousModel = selectedModel;
    setSelectedModel(nextModel);
    setSavingModel(true);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: nextModel }),
      });
      if (!res.ok) throw new Error("Failed to switch model");
      const data = await res.json() as { current?: string; options?: string[] };
      setSelectedModel(data.current ?? nextModel);
      setModels((previousModels) => data.options ?? previousModels);
    } catch {
      setSelectedModel(previousModel);
    } finally {
      setSavingModel(false);
    }
  }

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
            <label className="sr-only" htmlFor="model-select">Model</label>
            <select
              id="model-select"
              className="h-7 max-w-[180px] rounded-md border border-cyan-400/15 bg-[#0a0e17] px-2 text-[10px] text-cyan-300/80 outline-none transition-colors hover:border-cyan-400/35 focus:border-cyan-400/60 disabled:opacity-50"
              value={selectedModel || info.model}
              disabled={savingModel || chatStreaming}
              title={chatStreaming ? "Wait for the current response to finish" : savingModel ? "Switching model..." : "Switch model"}
              onChange={(event) => onModelChange(event.target.value)}
            >
              {models.length === 0 && (
                <option value={selectedModel || info.model}>{selectedModel || info.model}</option>
              )}
              {models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
            <span className="w-px h-3 bg-cyan-400/15" />
            <label className="sr-only" htmlFor="avatar-model-select">Avatar model</label>
            <select
              id="avatar-model-select"
              className="h-7 max-w-[120px] rounded-md border border-cyan-400/15 bg-[#0a0e17] px-2 text-[10px] text-cyan-300/80 outline-none transition-colors hover:border-cyan-400/35 focus:border-cyan-400/60"
              value={avatarModelPath}
              title="Switch character model"
              onChange={(event) => onAvatarModelChange(event.target.value)}
            >
              {avatarModelOptions.map((model) => (
                <option key={model.path} value={model.path}>{model.label}</option>
              ))}
            </select>
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
