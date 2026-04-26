import { useState, useEffect } from "react";

export interface SystemInfo {
  cpu: string;
  memory: string;
  disk: string;
  gpu: string;
  os: string;
  model: string;
  runtime: string;
  hermes_version: string;
}

export function useSystemInfo(intervalMs = 10000) {
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch("/api/system/info");
        if (res.ok && active) setInfo(await res.json());
      } catch {
        /* ignore */
      }
    }

    poll();
    const timer = setInterval(poll, intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return info;
}
