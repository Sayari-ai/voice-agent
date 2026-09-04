import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ icon, title, right }: { icon?: ReactNode; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
            {icon}
          </span>
        )}
        <h2 className="text-sm font-semibold text-navy-950">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export type ChipTone = "gray" | "green" | "amber" | "red" | "gold" | "navy";

const chipTones: Record<ChipTone, string> = {
  gray: "border-slate-200 bg-slate-50 text-slate-600",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-red-200 bg-red-50 text-red-700",
  gold: "border-gold-200 bg-gold-50 text-gold-700",
  navy: "border-navy-100 bg-navy-50 text-navy-800",
};

export function Chip({
  tone = "gray",
  children,
  pulse = false,
}: {
  tone?: ChipTone;
  children: ReactNode;
  pulse?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${chipTones[tone]}`}
    >
      {pulse && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-navy-950 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function DemoBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
      </span>
      {compact ? "Demo Mode" : "Demo Mode Simulated Enterprise Backend"}
    </span>
  );
}

export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg bg-navy-900 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none" aria-hidden="true">
        <rect x="3.5" y="9" width="2.6" height="6" rx="1.3" fill="#e08c16" />
        <rect x="8.2" y="5.5" width="2.6" height="13" rx="1.3" fill="#f0a428" />
        <rect x="12.9" y="3" width="2.6" height="18" rx="1.3" fill="#e08c16" />
        <rect x="17.6" y="7" width="2.6" height="10" rx="1.3" fill="#f6dcae" />
      </svg>
    </span>
  );
}

export function Bar({ value, className = "bg-gold-500" }: { value: number; className?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-all duration-700 ${className}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
