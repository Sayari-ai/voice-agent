"use client";

const BAR_COUNT = 44;
const heights = Array.from({ length: BAR_COUNT }, (_, i) => 8 + ((i * 7919 + 13) % 19));

export function Waveform({ mode }: { mode: "idle" | "customer" | "agent" }) {
  const active = mode !== "idle";
  const color =
    mode === "customer" ? "bg-gold-500" : mode === "agent" ? "bg-navy-700" : "bg-slate-300";

  return (
    <div className="flex h-14 items-center justify-center gap-[3px]" aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full transition-colors duration-300 ${color} ${active ? "animate-wave" : ""}`}
          style={{
            height: `${h}px`,
            animationDelay: `${(i % 9) * 90}ms`,
            animationDuration: `${700 + (i % 5) * 110}ms`,
          }}
        />
      ))}
    </div>
  );
}
