"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  Globe,
  Mic,
  Phone,
  PhoneForwarded,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
} from "lucide-react";
import { Bar, Card, CardHeader, Chip, PageHeader, type ChipTone } from "@/components/ui";
import { scenarios, type Scenario } from "@/lib/scenarios";
import { Waveform } from "./waveform";

type Phase =
  | "idle"
  | "connecting"
  | "listening"
  | "analyzing"
  | "acting"
  | "responding"
  | "resolved"
  | "escalated";

interface Msg {
  id: number;
  role: "customer" | "agent" | "system";
  hausa?: string;
  english?: string;
  text?: string;
}

interface ConsoleState {
  scenario: Scenario | null;
  phase: Phase;
  messages: Msg[];
  language: Scenario["language"] | null;
  intent: Scenario["intent"] | null;
  apiState: "idle" | "pending" | "success" | "blocked";
  outcome: "resolved" | "escalated" | null;
  manualTransfer: boolean;
  playing: boolean;
}

const initialState: ConsoleState = {
  scenario: null,
  phase: "idle",
  messages: [],
  language: null,
  intent: null,
  apiState: "idle",
  outcome: null,
  manualTransfer: false,
  playing: false,
};

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const btn =
  "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 disabled:cursor-not-allowed disabled:opacity-40";

function Typed({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, 24);
    return () => clearInterval(id);
  }, [text]);
  return (
    <span>
      {text.slice(0, n)}
      {n < text.length && <span className="animate-pulse text-gold-600">▌</span>}
    </span>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  if (msg.role === "system") {
    return (
      <div className="animate-fade-up flex justify-center">
        <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-center text-[11px] text-slate-500">
          {msg.text}
        </span>
      </div>
    );
  }
  const isCustomer = msg.role === "customer";
  return (
    <div className={`animate-fade-up flex ${isCustomer ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-xl border px-3.5 py-2.5 ${
          isCustomer ? "border-slate-200 bg-white" : "border-navy-100 bg-navy-50"
        }`}
      >
        <p
          className={`mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${
            isCustomer ? "text-slate-400" : "text-navy-500"
          }`}
        >
          {isCustomer ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
          {isCustomer ? "Customer · Hausa" : "Afriklang Agent · Hausa"}
        </p>
        <p className="text-sm leading-relaxed text-navy-950">
          <Typed text={msg.hausa ?? ""} />
        </p>
        <p className="mt-1 text-xs italic leading-relaxed text-slate-500">“{msg.english}”</p>
      </div>
    </div>
  );
}

function ImpactTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-navy-950">{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

export function LiveAgentConsole() {
  const [s, setS] = useState<ConsoleState>(initialState);
  const [seconds, setSeconds] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const patch = (p: Partial<ConsoleState>) => setS((prev) => ({ ...prev, ...p }));
  const push = (m: Omit<Msg, "id">) =>
    setS((prev) => ({ ...prev, messages: [...prev.messages, { ...m, id: nextId.current++ }] }));
  const schedule = (fn: () => void, delay: number) => {
    timers.current.push(setTimeout(fn, delay));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  const running = s.scenario !== null && s.outcome === null;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.messages.length]);

  function start(id: "balance" | "fraud") {
    const sc = scenarios[id];
    clearTimers();
    setSeconds(0);
    nextId.current = 1;
    setS({
      ...initialState,
      scenario: sc,
      phase: "connecting",
      messages: [
        { id: 0, role: "system", text: `Incoming call · ${sc.caller.org} · routed to Afriklang voice agent` },
      ],
    });

    schedule(() => {
      patch({ phase: "listening" });
      push({ role: "customer", hausa: sc.customer.hausa, english: sc.customer.english });
    }, 700);
    schedule(() => patch({ phase: "analyzing", language: sc.language }), 3100);
    schedule(() => patch({ intent: sc.intent }), 4000);

    if (!sc.api.blocked) {
      schedule(() => {
        patch({ phase: "acting", apiState: "pending" });
        push({ role: "system", text: `Tool call: ${sc.api.tool} → ${sc.api.system}` });
      }, 4900);
      schedule(() => patch({ apiState: "success" }), 6300);
      schedule(() => {
        patch({ phase: "responding", playing: true });
        push({ role: "agent", hausa: sc.agent.hausa, english: sc.agent.english });
      }, 7000);
      schedule(() => {
        patch({ playing: false, phase: "resolved", outcome: "resolved" });
        push({ role: "system", text: "Call resolved autonomously wrap-up summary and audit log saved" });
      }, 10600);
    } else {
      schedule(() => {
        patch({ phase: "acting", apiState: "blocked" });
        push({ role: "system", text: "Guardrail triggered autonomous handling disabled for high-risk intent" });
      }, 4900);
      schedule(() => {
        patch({ phase: "responding", playing: true });
        push({ role: "agent", hausa: sc.agent.hausa, english: sc.agent.english });
      }, 6000);
      schedule(() => {
        patch({ playing: false, phase: "escalated", outcome: "escalated" });
        push({ role: "system", text: `Transferred to human agent ${sc.api.handoff?.queue}` });
      }, 9600);
    }
  }

  function transferToHuman() {
    if (!s.scenario || s.outcome) return;
    clearTimers();
    patch({ playing: false, phase: "escalated", outcome: "escalated", manualTransfer: true });
    push({ role: "system", text: "Manual transfer supervisor moved this call to a human agent with full context" });
  }

  function playResponse() {
    if (s.playing || !s.messages.some((m) => m.role === "agent")) return;
    patch({ playing: true });
    schedule(() => patch({ playing: false }), 3200);
  }

  function resetDemo() {
    clearTimers();
    setSeconds(0);
    nextId.current = 1;
    setS(initialState);
  }

  const canPlay = !s.playing && s.messages.some((m) => m.role === "agent");
  const canTransfer = s.scenario !== null && s.outcome === null;

  const status: { label: string; tone: ChipTone; pulse?: boolean } =
    s.outcome === "resolved"
      ? { label: "Resolved", tone: "green" }
      : s.outcome === "escalated"
        ? { label: "Escalated to human", tone: "red" }
        : s.phase === "idle"
          ? { label: "Idle", tone: "gray" }
          : s.phase === "connecting"
            ? { label: "Connecting…", tone: "amber", pulse: true }
            : s.phase === "listening"
              ? { label: "Live · customer speaking", tone: "green", pulse: true }
              : s.phase === "analyzing"
                ? { label: "Analyzing", tone: "amber", pulse: true }
                : s.phase === "acting"
                  ? { label: "Executing action", tone: "navy", pulse: true }
                  : { label: "Agent responding", tone: "navy", pulse: true };

  const waveMode = s.playing ? ("agent" as const) : s.phase === "listening" ? ("customer" as const) : ("idle" as const);
  const waveLabel = s.playing
    ? "Agent speaking · Hausa voice “Amina”"
    : s.phase === "listening"
      ? "Customer speaking · live transcription"
      : s.outcome
        ? "Call ended"
        : s.scenario
          ? "Line quiet"
          : "Line idle run a simulation";

  const apiChip =
    s.apiState === "pending" ? (
      <Chip tone="amber" pulse>
        Pending
      </Chip>
    ) : s.apiState === "success" ? (
      <Chip tone="green">200 OK</Chip>
    ) : s.apiState === "blocked" ? (
      <Chip tone="red">Blocked by policy</Chip>
    ) : (
      <Chip tone="gray">Not called</Chip>
    );

  const manualImpact = [
    { label: "Time to handoff", value: fmtTime(seconds), sub: "Supervisor-initiated" },
    { label: "Context transferred", value: "100%", sub: "Transcript, intent, identity" },
    { label: "Autonomous actions", value: s.apiState === "success" ? "1 completed" : "None", sub: "Prior to transfer" },
    { label: "Audit trail", value: "Recorded", sub: "Full compliance log" },
  ];
  const impact = s.outcome ? (s.manualTransfer ? manualImpact : s.scenario!.impact) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Live Agent Console"
        subtitle="Watch the autonomous agent detect language and intent, act on enterprise systems, and escalate safely when risk is high."
      />

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-amber-900">Demo Mode Simulated Enterprise Backend</p>
          <p className="text-xs text-amber-800/80">
            All customers, transcripts, balances and API responses are mocked. No real systems are contacted.
          </p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={() => start("balance")} className={`${btn} bg-gold-500 text-navy-950 hover:bg-gold-400`}>
            <Phone className="h-4 w-4" /> Simulate Data-Balance Call
          </button>
          <button
            onClick={() => start("fraud")}
            className={`${btn} border border-amber-300 bg-white text-amber-800 hover:bg-amber-50`}
          >
            <ShieldAlert className="h-4 w-4" /> Simulate Sensitive Request
          </button>
          <button
            onClick={playResponse}
            disabled={!canPlay}
            className={`${btn} border border-navy-100 bg-white text-navy-800 hover:bg-navy-50`}
          >
            <Play className="h-4 w-4" /> Play Response
          </button>
          <button
            onClick={transferToHuman}
            disabled={!canTransfer}
            className={`${btn} border border-red-200 bg-white text-red-700 hover:bg-red-50`}
          >
            <PhoneForwarded className="h-4 w-4" /> Transfer to Human
          </button>
          <button
            onClick={resetDemo}
            disabled={s.scenario === null}
            className={`${btn} text-slate-600 hover:bg-slate-100`}
          >
            <RotateCcw className="h-4 w-4" /> Reset Demo
          </button>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Card 1 Customer Conversation */}
        <Card>
          <CardHeader
            icon={<Mic className="h-4 w-4" />}
            title="Customer Conversation"
            right={
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-400">{fmtTime(seconds)}</span>
                <Chip tone={status.tone} pulse={status.pulse}>
                  {status.label}
                </Chip>
              </span>
            }
          />
          <div className="p-5">
            {s.scenario ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-50 text-sm font-semibold text-navy-800">
                  {s.scenario.caller.name.split(" ").map((w) => w[0]).join("")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy-950">
                    {s.scenario.caller.name}{" "}
                    <span className="font-normal text-slate-400">· {s.scenario.caller.msisdn}</span>
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {s.scenario.caller.org} · {s.scenario.caller.customerId}
                  </p>
                </div>
                <span className="ml-auto hidden sm:block">
                  <Chip tone="navy">{s.scenario.caller.segment}</Chip>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-slate-400">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                  <Phone className="h-4 w-4" />
                </span>
                <p className="text-sm">No active call use the controls above to start a scenario.</p>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
              <Waveform mode={waveMode} />
              <p className="mt-1.5 text-center text-[11px] font-medium text-slate-500">{waveLabel}</p>
            </div>

            <div ref={scrollRef} aria-live="polite" className="mt-4 h-72 space-y-3 overflow-y-auto pr-1">
              {s.messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                  <Mic className="h-6 w-6" />
                  <p className="text-sm">The live transcript will appear here.</p>
                  <p className="text-xs">Hausa audio is transcribed and translated in real time.</p>
                </div>
              ) : (
                s.messages.map((m) => <MessageBubble key={m.id} msg={m} />)
              )}
            </div>
          </div>
        </Card>

        {/* Card 2 AI Interpretation */}
        <Card>
          <CardHeader
            icon={<Sparkles className="h-4 w-4" />}
            title="AI Interpretation"
            right={
              s.phase === "analyzing" && !s.intent ? (
                <Chip tone="amber" pulse>
                  Processing
                </Chip>
              ) : undefined
            }
          />
          <div className="space-y-5 p-5">
            <div>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <Globe className="h-3.5 w-3.5" /> Language detected
                </p>
                <span className="text-xs font-semibold text-navy-900">
                  {s.language ? `${s.language.confidence.toFixed(1)}%` : "—"}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-navy-950">
                {s.language ? s.language.name : <span className="font-normal text-slate-400">Awaiting audio…</span>}
                {s.language && (
                  <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-normal text-slate-500">
                    {s.language.code}
                  </span>
                )}
              </p>
              <div className="mt-2">
                <Bar value={s.language?.confidence ?? 0} className="bg-gold-500" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <Sparkles className="h-3.5 w-3.5" /> Customer intent
                </p>
                <span className="text-xs font-semibold text-navy-900">
                  {s.intent ? `${s.intent.confidence.toFixed(1)}%` : "—"}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-navy-950">
                {s.intent ? s.intent.label : <span className="font-normal text-slate-400">Awaiting analysis…</span>}
                {s.intent && (
                  <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-normal text-slate-500">
                    {s.intent.id}
                  </span>
                )}
              </p>
              <div className="mt-2">
                <Bar value={s.intent?.confidence ?? 0} className="bg-navy-600" />
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              {s.intent?.risk === "high" ? (
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              ) : (
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              )}
              <div>
                <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  Risk assessment
                  {s.intent && (
                    <Chip tone={s.intent.risk === "high" ? "red" : "green"}>
                      {s.intent.risk === "high" ? "High risk" : "Low risk"}
                    </Chip>
                  )}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {s.intent ? s.intent.rationale : "Risk is evaluated once the intent is known."}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              {s.manualTransfer ? (
                <PhoneForwarded className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              ) : s.intent?.risk === "high" ? (
                <PhoneForwarded className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              ) : s.intent ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
              )}
              <div>
                <p className="text-xs font-medium text-slate-500">Routing decision</p>
                <p className="mt-0.5 text-sm font-medium text-navy-950">
                  {s.manualTransfer
                    ? "Manually transferred by supervisor"
                    : s.intent
                      ? s.intent.risk === "high"
                        ? "Human handoff required policy"
                        : "Autonomous resolution approved"
                      : "—"}
                </p>
              </div>
            </div>

            {s.intent?.risk === "high" && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs leading-relaxed text-amber-800">
                  Policy guardrail: fraud, account-security and legal intents are never resolved autonomously. The
                  agent reassures the customer and hands off with full context.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Card 3 Enterprise Action & Impact */}
        <Card>
          <CardHeader
            icon={<Database className="h-4 w-4" />}
            title="Enterprise Action & Impact"
            right={<Chip tone="gold">Simulated</Chip>}
          />
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500">Connected system</span>
              <span className="text-right font-medium text-navy-900">
                {s.scenario ? s.scenario.api.system : "—"}
              </span>
            </div>

            {s.scenario ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-navy-900">
                    <span className="font-semibold text-gold-700">{s.scenario.api.tool}</span>()
                  </span>
                  {apiChip}
                </div>
                <p className="mt-1.5 break-all text-slate-500">
                  {s.scenario.api.method} {s.scenario.api.endpoint}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                Run a simulation to see the enterprise API call.
              </div>
            )}

            {s.apiState === "success" && s.scenario?.api.responseBody && (
              <pre className="max-h-40 overflow-auto rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 font-mono text-[11px] leading-relaxed text-navy-900">
                {JSON.stringify(s.scenario.api.responseBody, null, 2)}
              </pre>
            )}

            {s.apiState === "blocked" && s.scenario?.api.policyNote && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs leading-relaxed text-amber-800">{s.scenario.api.policyNote}</p>
              </div>
            )}

            {s.apiState === "blocked" && s.scenario?.api.handoff && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3.5">
                <p className="flex items-center gap-2 text-xs font-semibold text-red-800">
                  <PhoneForwarded className="h-3.5 w-3.5" /> Human handoff package {s.scenario.api.handoff.queue}
                </p>
                <ul className="mt-2 space-y-1">
                  {s.scenario.api.handoff.context.map((c) => (
                    <li key={c} className="flex items-start gap-1.5 text-xs text-red-700/90">
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-red-600">{s.scenario.api.handoff.sla}</p>
              </div>
            )}

            <div className="border-t border-slate-100 pt-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <TrendingUp className="h-3.5 w-3.5" /> Business impact
              </p>
              <div className="mt-3 space-y-3">
                {s.outcome === "resolved" && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">Resolved autonomously</p>
                      <p className="text-xs text-emerald-700/80">
                        Intent fulfilled in Hausa without human assistance.
                      </p>
                    </div>
                  </div>
                )}
                {s.outcome === "escalated" && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3">
                    <PhoneForwarded className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">Escalated to human agent</p>
                      <p className="text-xs text-red-700/80">
                        {s.manualTransfer
                          ? "Supervisor transferred this call. Full context delivered to the human agent."
                          : "High-risk intent routed to the Fraud & Security priority queue with full context."}
                      </p>
                    </div>
                  </div>
                )}
                {!s.outcome && (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                    Outcome will appear here once the call completes.
                  </div>
                )}
                {impact && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {impact.map((it) => (
                      <ImpactTile key={it.label} label={it.label} value={it.value} sub={it.sub} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
