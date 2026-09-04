"use client";

import { useEffect, useState } from "react";

export interface SpeechHealth {
  status: "checking" | "online" | "offline";
  device?: string;
  asrModel?: string;
}

export function useSpeechHealth(): SpeechHealth {
  const [health, setHealth] = useState<SpeechHealth>({ status: "checking" });

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch("/api/health");
        const data = res.ok
          ? ((await res.json()) as { ok: boolean; device?: string | null; asrModel?: string | null })
          : null;
        if (!alive) return;
        setHealth(
          data?.ok
            ? { status: "online", device: data.device ?? undefined, asrModel: data.asrModel ?? undefined }
            : { status: "offline" }
        );
      } catch {
        if (alive) setHealth({ status: "offline" });
      }
    };
    void check();
    const timer = setInterval(check, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return health;
}
