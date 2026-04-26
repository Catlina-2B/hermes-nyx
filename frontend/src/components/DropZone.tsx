import { useState } from "react";

interface Props {
  onDrop: () => void;
  vertical?: boolean;
  label?: string;
}

export default function DropZone({ onDrop, vertical, label }: Props) {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDrop();
      }}
      className={`flex items-center justify-center border-2 border-dashed rounded-lg transition-colors duration-150 font-mono text-[11px] select-none
        ${vertical ? "w-24 h-full mx-1 flex-col" : "h-16 w-full my-1"}
        ${over
          ? "border-cyan-400 bg-cyan-400/12 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
          : "border-cyan-800/50 bg-cyan-950/30 text-cyan-600/40"
        }
      `}
    >
      {over ? "◈ 释放停靠" : (label ?? "◈ 拖至此处")}
    </div>
  );
}
