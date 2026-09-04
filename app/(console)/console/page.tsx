import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Globe,
  Phone,
  PhoneForwarded,
  Star,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { Bar, Card, CardHeader, Chip, PageHeader, type ChipTone } from "@/components/ui";
import { languageShare } from "@/lib/mock-data";

export const metadata: Metadata = { title: "Overview" };

const kpis: {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: string;
  deltaTone?: ChipTone;
}[] = [
  { icon: Phone, label: "Calls handled today", value: "1,284", delta: "+12.4%", deltaTone: "green" },
  { icon: CheckCircle2, label: "Autonomous resolution", value: "87.3%", delta: "+2.1 pts", deltaTone: "green" },
  { icon: Timer, label: "Avg handle time", value: "47s", delta: "−9s", deltaTone: "green" },
  { icon: CircleDollarSign, label: "Est. cost saved today", value: "$4,920", delta: "+8.7%", deltaTone: "green" },
  { icon: Star, label: "CSAT (AI-handled)", value: "4.6 / 5", delta: "Stable", deltaTone: "gray" },
];

const liveCalls = [
  { caller: "+234 812 ••• 2201", language: "Hausa", intent: "airtime_topup", elapsed: "0:22" },
  { caller: "+234 705 ••• 1189", language: "Yoruba", intent: "data_balance_inquiry", elapsed: "0:37" },
  { caller: "+254 722 ••• 4410", language: "Swahili", intent: "bundle_purchase", elapsed: "1:02" },
  { caller: "+234 803 ••• 7754", language: "Igbo", intent: "account_statement", elapsed: "0:15" },
];

const recentEscalations = [
  { time: "14:29", customer: "Amina Bello", org: "First Unity Bank", intent: "fraud_report", note: "Human pickup in 24s" },
  { time: "14:09", customer: "Wanjiku Kamau", org: "Safaricom", intent: "sim_swap_request", note: "Human pickup in 41s" },
  { time: "13:36", customer: "Grace Otieno", org: "Safaricom", intent: "billing_dispute", note: "Human pickup in 38s" },
];

export default function OverviewPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Operations Overview"
        subtitle="Autonomous African-language customer service for banks and telcos sandbox tenant."
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map(({ icon: Icon, label, value, delta, deltaTone }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                <Icon className="h-4 w-4" />
              </span>
              {delta && <Chip tone={deltaTone}>{delta}</Chip>}
            </div>
            <p className="mt-3 text-xl font-semibold tracking-tight text-navy-950">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </Card>
        ))}
      </div>

      <Card className="flex flex-col justify-between gap-4 border-l-4 border-l-gold-500 p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-semibold text-navy-950">See the agent in action</h2>
          <p className="mt-1 text-sm text-slate-500">
            Run the Hausa data-balance and fraud-escalation scenarios in the Live Agent console.
          </p>
        </div>
        <Link
          href="/live-agent"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 transition-colors hover:bg-gold-400"
        >
          Open Live Agent <ArrowUpRight className="h-4 w-4" />
        </Link>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader icon={<Globe className="h-4 w-4" />} title="Language mix today" />
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
          <CardHeader
            icon={<Phone className="h-4 w-4" />}
            title="Live right now"
            right={
              <Chip tone="green" pulse>
                23 active calls
              </Chip>
            }
          />
          <div className="divide-y divide-slate-50">
            {liveCalls.map((c) => (
              <div key={c.caller} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-navy-900">{c.caller}</p>
                  <p className="truncate font-mono text-[11px] text-slate-400">{c.intent}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Chip tone="navy">{c.language}</Chip>
                  <span className="font-mono text-xs text-slate-500">{c.elapsed}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={<PhoneForwarded className="h-4 w-4" />}
            title="Recent escalations"
            right={<Chip tone="red">3 today</Chip>}
          />
          <div className="divide-y divide-slate-50">
            {recentEscalations.map((e) => (
              <div key={e.time} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-navy-950">{e.customer}</p>
                  <span className="font-mono text-xs text-slate-400">{e.time}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Chip tone="red">{e.intent}</Chip>
                  <span className="text-xs text-slate-500">{e.org}</span>
                </div>
                <p className="mt-1 text-xs text-emerald-700">{e.note}</p>
              </div>
            ))}
            <p className="px-5 py-3 text-xs text-slate-400">
              Every escalation hands off the transcript, intent and customer context.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
