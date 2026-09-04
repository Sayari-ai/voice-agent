import type { Metadata } from "next";
import { Card, CardHeader, Chip, Bar, PageHeader } from "@/components/ui";
import {
  containmentTrend,
  escalationReasons,
  languageShare,
  topIntents,
  weeklyCalls,
} from "@/lib/mock-data";
import { BarChart3, Globe, PhoneForwarded, Sparkles, TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "Analytics" };

function TrendChart() {
  const min = 80;
  const max = 90;
  const pts = containmentTrend.map(
    (v, i) =>
      `${(i / (containmentTrend.length - 1)) * 100},${100 - ((v - min) / (max - min)) * 100}`,
  );
  return (
    <div className="p-5">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-40 w-full">
        <polygon points={`0,100 ${pts.join(" ")} 100,100`} className="fill-gold-100" />
        <polyline
          points={pts.join(" ")}
          className="stroke-gold-600"
          fill="none"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        {containmentTrend.map((_, i) => (
          <span key={i}>W{i + 1}</span>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Autonomous resolution climbed from {containmentTrend[0]}% to{" "}
        <span className="font-semibold text-emerald-700">
          {containmentTrend[containmentTrend.length - 1]}%
        </span>{" "}
        over the last 8 weeks.
      </p>
    </div>
  );
}

function WeeklyChart() {
  const max = Math.max(...weeklyCalls.map((w) => w.calls));
  return (
    <div className="p-5">
      <div className="flex h-40 items-end gap-3">
        {weeklyCalls.map((w) => (
          <div key={w.day} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-[10px] font-medium text-slate-500">{w.calls.toLocaleString()}</span>
            <div
              className="w-full rounded-t-md bg-navy-700"
              style={{ height: `${(w.calls / max) * 100}%` }}
            />
            <span className="text-[11px] text-slate-500">{w.day}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        8,139 calls handled this week across all connected tenants.
      </p>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        subtitle="Performance of the autonomous voice agents across languages, intents and outcomes."
        action={<Chip tone="gold">Last 7 days · mock data</Chip>}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={<TrendingUp className="h-4 w-4" />}
            title="Autonomous resolution rate"
            right={<Chip tone="green">87.3%</Chip>}
          />
          <TrendChart />
        </Card>
        <Card>
          <CardHeader
            icon={<BarChart3 className="h-4 w-4" />}
            title="Calls per day"
            right={<Chip tone="navy">8,139 total</Chip>}
          />
          <WeeklyChart />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader icon={<Globe className="h-4 w-4" />} title="Calls by language" />
          <div className="space-y-4 p-5">
            {languageShare.map((l) => (
              <div key={l.language}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-navy-900">{l.language}</span>
                  <span className="text-slate-500">{l.share}%</span>
                </div>
                <Bar value={l.share} className="bg-gold-500" />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Sparkles className="h-4 w-4" />} title="Top intents" />
          <div className="space-y-4 p-5">
            {topIntents.map((t) => (
              <div key={t.intent}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-mono text-navy-900">{t.intent}</span>
                  <span className="text-slate-500">{t.share}%</span>
                </div>
                <Bar value={t.share * 3} className="bg-navy-600" />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader icon={<PhoneForwarded className="h-4 w-4" />} title="Escalation reasons" />
          <div className="space-y-3 p-5">
            {escalationReasons.map((r) => (
              <div
                key={r.reason}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5"
              >
                <span className="text-xs font-medium text-navy-900">{r.reason}</span>
                <Chip tone={r.tone}>{r.count} calls</Chip>
              </div>
            ))}
            <p className="pt-1 text-xs leading-relaxed text-slate-500">
              12.7% of calls were escalated this week. Every escalation includes the full transcript
              and detected intent, so human agents never start from zero.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
