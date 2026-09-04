"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, Chip, PageHeader, type ChipTone } from "@/components/ui";
import { conversations } from "@/lib/mock-data";
import { useSimCalls } from "@/lib/sim-history";

const outcomeTone: Record<string, ChipTone> = {
  Resolved: "green",
  Escalated: "red",
  "In progress": "amber",
};

const filters = ["All", "Resolved", "Escalated", "In progress"] as const;

export function ConversationsView() {
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof filters)[number]>("All");
  const simCalls = useSimCalls();

  const rows = useMemo(
    () =>
      [...simCalls, ...conversations].filter(
        (c) =>
          (f === "All" || c.outcome === f) &&
          (q === "" ||
            [c.customer, c.intent, c.language, c.org, c.id].some((v) =>
              v.toLowerCase().includes(q.toLowerCase()),
            )),
      ),
    [q, f, simCalls],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Conversations"
        subtitle="Every call handled by the voice agent today, with detected language, intent and outcome."
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customer, intent, language…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-navy-900 placeholder:text-slate-400 focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-100"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((name) => (
            <button
              key={name}
              onClick={() => setF(name)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                f === name
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-navy-200 hover:text-navy-900"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Call ID</th>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Organisation</th>
                <th className="px-5 py-3 font-medium">Language</th>
                <th className="px-5 py-3 font-medium">Intent</th>
                <th className="px-5 py-3 font-medium">Duration</th>
                <th className="px-5 py-3 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{c.id}</td>
                  <td className="px-5 py-3 text-slate-500">{c.time}</td>
                  <td className="px-5 py-3 font-medium text-navy-950">{c.customer}</td>
                  <td className="px-5 py-3 text-slate-600">{c.org}</td>
                  <td className="px-5 py-3">
                    <Chip tone="navy">{c.language}</Chip>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">{c.intent}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{c.duration}</td>
                  <td className="px-5 py-3">
                    <Chip tone={outcomeTone[c.outcome]}>{c.outcome}</Chip>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">
                    No conversations match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
          Showing {rows.length} of {conversations.length} conversations · mock data
        </p>
      </Card>
    </div>
  );
}
