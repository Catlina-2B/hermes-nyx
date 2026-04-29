import { useState, useEffect } from "react";

interface ReminderData {
  id: string;
  content: string;
  deadline: string;
}

export default function ReminderApp() {
  const [reminder, setReminder] = useState<ReminderData | null>(null);

  useEffect(() => {
    const hd = (window as any).hermesDesktop;
    if (!hd?.onReminderData) return;
    hd.onReminderData((data: ReminderData) => {
      setReminder(data);
    });
  }, []);

  function dismiss() {
    const hd = (window as any).hermesDesktop;
    if (reminder) {
      hd?.dismissReminder?.(reminder.id);
    }
  }

  function formatTime(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  if (!reminder) return null;

  return (
    <div className="w-full h-full flex items-center justify-center p-3">
      <div className="w-full rounded-xl border border-cyan-400/20 bg-[#0a0e17]/95 backdrop-blur-xl shadow-[0_0_40px_rgba(34,211,238,0.15)] p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse" />
          <span className="text-[10px] font-mono text-cyan-400/70 tracking-wider">REMINDER</span>
          <span className="ml-auto text-[10px] font-mono text-cyan-300/60">{formatTime(reminder.deadline)}</span>
        </div>

        {/* Content */}
        <p className="text-sm font-sans text-white/90 leading-relaxed mb-4 break-words line-clamp-3">
          {reminder.content}
        </p>

        {/* Dismiss button */}
        <button
          onClick={dismiss}
          className="w-full py-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/5 text-xs font-mono text-cyan-300 hover:bg-cyan-400/15 hover:border-cyan-400/40 transition-colors"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
