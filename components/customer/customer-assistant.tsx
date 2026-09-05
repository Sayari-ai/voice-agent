"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Globe,
  Lock,
  Mic,
  PhoneForwarded,
  RotateCcw,
  ShieldCheck,
  User,
  Volume2,
} from "lucide-react";
import { Bar, Chip, DemoBadge, Logo } from "@/components/ui";
import { scenarios, type Scenario } from "@/lib/scenarios";
import { Waveform } from "@/components/live/waveform";
import { useSpeechHealth } from "@/lib/use-speech-health";

type Phase = "idle" | "listening" | "thinking" | "responding" | "done";

type Lang = "wo";

const LANG_META: Record<Lang, { label: string }> = {
  wo: { label: "Wolof" },
};

interface Handoff {
  queue: string;
  sla: string;
  caseId?: string;
}

interface Msg {
  id: number;
  role: "customer" | "agent" | "status";
  primary?: string;
  english?: string;
  lang?: string;
  text?: string;
  card?: "balance" | "handoff";
  handoff?: Handoff;
}

interface AssistantState {
  scenario: Scenario | null;
  mode: "scripted" | "live" | null;
  phase: Phase;
  outcome: "resolved" | "human" | null;
  messages: Msg[];
  playing: boolean;
}

const initialState: AssistantState = {
  scenario: null,
  mode: null,
  phase: "idle",
  outcome: null,
  messages: [],
  playing: false,
};

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const btn =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 disabled:cursor-not-allowed disabled:opacity-40";

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

function BalanceCard({ scenario }: { scenario: Scenario }) {
  const rb = scenario.api.responseBody as
    | { bundle: string; remaining_gb: number; expires_at: string; auto_renew: boolean }
    | undefined;
  if (!rb) return null;
  return (
    <div className="animate-fade-up ml-auto w-full max-w-[85%] rounded-xl border border-gold-200 bg-gold-50/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-navy-700">{rb.bundle}</p>
        {rb.auto_renew && <Chip tone="green">Auto-renew on</Chip>}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-navy-950">
        {rb.remaining_gb} GB <span className="text-sm font-normal text-slate-500">remaining</span>
      </p>
      <div className="mt-2">
        <Bar value={(rb.remaining_gb / 10) * 100} />
      </div>
      <p className="mt-2 text-xs text-slate-500">Expires 12 September 2026 · {scenario.caller.org}</p>
    </div>
  );
}

function HandoffCard({ handoff }: { handoff: Handoff }) {
  return (
    <div className="animate-fade-up ml-auto w-full max-w-[85%] rounded-xl border border-red-200 bg-red-50/60 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
        <PhoneForwarded className="h-4 w-4" /> A human specialist is taking over
      </p>
      <div className="mt-2 space-y-1 text-xs text-navy-900">
        <p>
          <span className="text-slate-500">Queue:</span> {handoff.queue}
        </p>
        <p>
          <span className="text-slate-500">Pickup:</span> {handoff.sla}
        </p>
        {handoff.caseId && (
          <p>
            <span className="text-slate-500">Case:</span>{" "}
            <span className="font-mono">{handoff.caseId}</span>
          </p>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        Your conversation, language and details travel with you no need to repeat yourself.
      </p>
    </div>
  );
}

function MessageBubble({ msg, scenario }: { msg: Msg; scenario: Scenario | null }) {
  if (msg.role === "status") {
    return (
      <div className="animate-fade-up flex justify-center">
        <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-center text-[11px] text-slate-500">
          {msg.text}
        </span>
      </div>
    );
  }
  if (msg.card === "balance") {
    return scenario ? <BalanceCard scenario={scenario} /> : null;
  }
  if (msg.card === "handoff" && msg.handoff) return <HandoffCard handoff={msg.handoff} />;

  const isCustomer = msg.role === "customer";
  const langLabel = msg.lang ?? "Hausa";
  return (
    <div className={`animate-fade-up flex ${isCustomer ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl border px-3.5 py-2.5 ${
          isCustomer ? "border-navy-100 bg-navy-50" : "border-slate-200 bg-white"
        }`}
      >
        <p
          className={`mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${
            isCustomer ? "text-navy-500" : "text-slate-400"
          }`}
        >
          {isCustomer ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
          {isCustomer ? `You · ${langLabel}` : `Assistant · ${langLabel}`}
        </p>
        <p className="text-sm leading-relaxed text-navy-950">
          <Typed text={msg.primary ?? ""} />
        </p>
        {msg.english && (
          <p className="mt-1 text-xs italic leading-relaxed text-slate-500">“{msg.english}”</p>
        )}
      </div>
    </div>
  );
}

export function CustomerAssistant() {
  const [state, setState] = useState<AssistantState>(initialState);
  const [seconds, setSeconds] = useState(0);
  const lang: Lang = "wo";
  const health = useSpeechHealth();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const sessionId = useRef("");

  const patch = (p: Partial<AssistantState>) => setState((s) => ({ ...s, ...p }));
  const push = (m: Omit<Msg, "id">) =>
    setState((s) => ({ ...s, messages: [...s.messages, { ...m, id: nextId.current++ }] }));

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const schedule = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const stopTicker = () => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  };

  const releaseMic = () => {
    if (recorder.current && recorder.current.state !== "inactive") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    recorder.current = null;
    micStream.current?.getTracks().forEach((t) => t.stop());
    micStream.current = null;
    chunks.current = [];
  };

  const releaseAudio = () => {
    audioEl.current?.pause();
    audioEl.current = null;
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state.messages.length]);

  useEffect(
    () => () => {
      clearTimers();
      stopTicker();
      releaseMic();
      releaseAudio();
    },
    []
  );

  const playAgentAudio = (base64: string, onDone: () => void) => {
    try {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      releaseAudio();
      audioUrl.current = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
      const audio = new Audio(audioUrl.current);
      audioEl.current = audio;
      audio.onended = onDone;
      audio.onerror = onDone;
      void audio.play().catch(onDone);
    } catch {
      onDone();
    }
  };

  // One voice turn against the real agent (INTEGRATION.md §9): ASR + LLM + TTS
  // server-side; session_id keeps the conversation context across turns.
  const agentTurn = async (blob: Blob, l: Lang) => {
    patch({ phase: "thinking" });
    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      form.append("file", blob, `clip.${ext}`);
      form.append("lang", l);
      form.append("session_id", sessionId.current);
      form.append("gender", "female");
      const res = await fetch("/api/agent", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Agent ${res.status}`);
      const data = (await res.json()) as {
        sessionId: string;
        text: string;
        responseText: string;
        model?: string;
        audioBase64: string;
      };
      const text = data.text?.trim();
      if (!text) {
        stopTicker();
        push({ role: "status", text: "Didn’t catch anything tap the mic and try again" });
        patch({ phase: "idle", mode: null });
        return;
      }
      sessionId.current = data.sessionId || sessionId.current;
      push({ role: "customer", primary: text, lang: LANG_META[l].label });
      patch({ phase: "responding", playing: true });
      push({
        role: "agent",
        primary: data.responseText,
        lang: LANG_META[l].label,
      });
      playAgentAudio(data.audioBase64, () => {
        stopTicker();
        patch({ playing: false, phase: "idle", mode: null });
      });
    } catch {
      stopTicker();
      push({ role: "status", text: "Agent service unavailable please try again shortly" });
      patch({ phase: "idle", mode: null });
    }
  };

  const toggleMic = async () => {
    if (state.phase === "listening" && state.mode === "live") {
      const rec = recorder.current;
      if (rec && rec.state !== "inactive") rec.stop();
      return;
    }
    if (state.phase !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream.current = stream;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
        MediaRecorder.isTypeSupported(t)
      );
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorder.current = rec;
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        releaseMic();
        void agentTurn(blob, lang);
      };
      setSeconds(0);
      stopTicker();
      ticker.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setState({ ...initialState, mode: "live", phase: "listening" });
      push({
        role: "status",
        text: `Listening in ${LANG_META[lang].label} tap the mic again when you’re done`,
      });
      rec.start();
    } catch {
      push({ role: "status", text: "Microphone access is needed for live voice check permissions" });
    }
  };

  const start = (id: "balance" | "fraud") => {
    if (state.phase !== "idle") return;
    const sc = scenarios[id];
    clearTimers();
    setSeconds(0);
    stopTicker();
    ticker.current = setInterval(() => setSeconds((s) => s + 1), 1000);

    setState({ ...initialState, scenario: sc, mode: "scripted", phase: "listening" });
    push({ role: "status", text: `Simulated caller: ${sc.caller.name} · ${sc.caller.org}` });
    push({ role: "customer", primary: sc.customer.hausa, english: sc.customer.english });

    const thinkingText =
      id === "balance"
        ? "Hausa detected · Checking your account securely…"
        : "Hausa detected · High-priority request arranging a specialist…";

    schedule(() => {
      patch({ phase: "thinking" });
      push({ role: "status", text: thinkingText });
    }, 2800);

    schedule(() => {
      patch({ phase: "responding", playing: true });
      push({ role: "agent", primary: sc.agent.hausa, english: sc.agent.english });
    }, 4600);

    schedule(() => {
      if (id === "balance") {
        push({ role: "agent", card: "balance" });
      } else {
        push({
          role: "agent",
          card: "handoff",
          handoff: {
            queue: sc.api.handoff?.queue ?? "Customer Care · Priority",
            sla: "Under 60 seconds",
            caseId: "FRD-2214",
          },
        });
      }
    }, 5800);

    schedule(() => {
      stopTicker();
      patch({ phase: "done", playing: false, outcome: id === "balance" ? "resolved" : "human" });
      push({
        role: "status",
        text:
          id === "balance"
            ? "Resolved in 46 seconds · No menus, no waiting"
            : "A specialist will answer in under 60 seconds",
      });
    }, 9600);
  };

  const transferToHuman = () => {
    if (state.phase === "idle" || state.phase === "done" || state.outcome === "human") return;
    clearTimers();
    stopTicker();
    patch({ phase: "responding", playing: true });
    push({ role: "status", text: "You asked for a human agent" });
    push({
      role: "agent",
      primary: "Babu damuwa. Zan haɗa ka da wakilin ɗan adam yanzu, ka riƙe layin.",
      english: "No problem. I am connecting you to a human agent now, please hold the line.",
    });
    schedule(() => {
      push({
        role: "agent",
        card: "handoff",
        handoff: { queue: "Customer Care · Priority", sla: "Under 60 seconds" },
      });
    }, 1600);
    schedule(() => {
      patch({ phase: "done", playing: false, outcome: "human" });
    }, 3600);
  };

  const playResponse = () => {
    if (state.playing || !state.messages.some((m) => m.role === "agent" && m.primary)) return;
    if (audioUrl.current) {
      patch({ playing: true });
      const audio = new Audio(audioUrl.current);
      audioEl.current = audio;
      audio.onended = () => patch({ playing: false });
      audio.onerror = () => patch({ playing: false });
      void audio.play();
      return;
    }
    patch({ playing: true });
    schedule(() => patch({ playing: false }), 3200);
  };

  const resetDemo = () => {
    clearTimers();
    stopTicker();
    releaseMic();
    releaseAudio();
    sessionId.current = "";
    setSeconds(0);
    setState(initialState);
  };

  const active = state.phase !== "idle" && state.phase !== "done";
  const hasAgentReply = state.messages.some((m) => m.role === "agent" && m.primary);
  const waveMode = state.playing
    ? "agent"
    : state.phase === "listening"
      ? "customer"
      : "idle";

  const live = state.mode === "live";
  const statusLine =
    state.phase === "idle"
      ? "Tap the mic and speak Wolof or try a scripted request below"
      : state.phase === "listening"
        ? live
          ? `Listening in ${LANG_META[lang].label}… tap the mic to finish`
          : "Ina sauraro… · Listening…"
        : state.phase === "thinking"
          ? live
            ? "The assistant is thinking about your request…"
            : "Ina duba maka… · Checking that for you…"
          : state.playing
            ? "Assistant is speaking…"
            : state.outcome === "resolved"
              ? live
                ? "Transcribed · Live model"
                : "An gama! · All done"
              : state.outcome === "human"
                ? "Hold on a human agent will speak with you shortly"
                : "…";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <Logo className="h-8 w-8" />
          <span>
            <span className="block text-sm font-semibold tracking-tight text-navy-950">
              Afriklang Assistant
            </span>
            <span className="block text-[11px] text-slate-500">Customer care in your language</span>
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:block">
              <DemoBadge />
            </span>
            <span className="sm:hidden">
              <DemoBadge compact />
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <section className="rounded-xl border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-100 px-5 py-4">
            <h1 className="text-lg font-semibold tracking-tight text-navy-950">
              Sannu! Yaya zan iya taimaka maka a yau?
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">Hello! How can I help you today?</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Chip tone="navy">Wolof</Chip>
              <span className="text-[11px] text-slate-400">
                Live speech model · tap the mic and speak Wolof
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 px-5 py-6">
            <button
              onClick={toggleMic}
              disabled={state.phase === "thinking" || state.phase === "responding" || state.phase === "done" || (state.phase === "listening" && !live)}
              aria-label={
                live && state.phase === "listening"
                  ? "Stop recording"
                  : `Tap to talk in ${LANG_META[lang].label}`
              }
              className={`flex h-20 w-20 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-300 disabled:cursor-not-allowed ${
                state.phase === "listening"
                  ? "bg-gold-500 text-navy-950 ring-4 ring-gold-200"
                  : "bg-navy-900 text-white hover:bg-navy-800"
              }`}
            >
              <Mic className="h-8 w-8" />
            </button>
            <div className="w-full max-w-sm">
              <Waveform mode={waveMode} />
            </div>
            <p className="text-xs text-slate-500" aria-live="polite">
              {statusLine}
              {active && <span className="ml-2 font-mono text-slate-400">{fmtTime(seconds)}</span>}
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  health.status === "online"
                    ? "bg-emerald-500"
                    : health.status === "offline"
                      ? "bg-red-500"
                      : "bg-slate-300"
                }`}
              />
              {health.status === "online"
                ? `Live ${LANG_META[lang].label} speech · Afriklang ASR online${health.device === "cuda" ? " · GPU" : ""}`
                : health.status === "offline"
                  ? "Speech service offline scripted demos still work"
                  : "Checking the Afriklang speech service…"}
            </p>
          </div>

          {state.messages.length > 0 && (
            <div
              ref={scrollRef}
              className="max-h-80 space-y-3 overflow-y-auto border-t border-slate-100 px-5 py-4"
              aria-live="polite"
            >
              {state.messages.map((m) => (
                <MessageBubble key={m.id} msg={m} scenario={state.scenario} />
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 px-5 py-4">
            {state.phase === "idle" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => start("balance")}
                  className={`${btn} border border-gold-200 bg-gold-50 text-left text-navy-900 hover:bg-gold-100`}
                >
                  <span>
                    <span className="block font-medium">“Nawa data na ya rage?”</span>
                    <span className="block text-xs font-normal text-slate-500">
                      Check my data balance
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => start("fraud")}
                  className={`${btn} border border-amber-200 bg-amber-50 text-left text-navy-900 hover:bg-amber-100`}
                >
                  <span>
                    <span className="block font-medium">“An cire kuɗi ba tare da sanina ba”</span>
                    <span className="block text-xs font-normal text-slate-500">
                      Report money taken from my account
                    </span>
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {state.outcome === "resolved" && <Chip tone="green">Resolved by the assistant</Chip>}
                {state.outcome === "human" && <Chip tone="red" pulse>Human agent on the way</Chip>}
                <span className="ml-auto flex flex-wrap gap-2">
                  <button
                    onClick={playResponse}
                    disabled={!hasAgentReply || state.playing}
                    className={`${btn} border border-navy-200 bg-white text-navy-800 hover:bg-navy-50`}
                  >
                    <Volume2 className="h-4 w-4" /> Play response
                  </button>
                  <button
                    onClick={transferToHuman}
                    disabled={!active || state.outcome === "human"}
                    className={`${btn} border border-red-200 bg-white text-red-700 hover:bg-red-50`}
                  >
                    <PhoneForwarded className="h-4 w-4" /> Talk to a human
                  </button>
                  <button
                    onClick={resetDemo}
                    className={`${btn} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
                  >
                    <RotateCcw className="h-4 w-4" /> Start over
                  </button>
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, text: "High-risk requests always go to a human specialist" },
            { icon: Lock, text: "No account action is taken without verification" },
            { icon: Globe, text: "Understands your language and dialect" },
          ].map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-card"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Icon className="h-4 w-4" />
              </span>
              <p className="text-xs leading-relaxed text-slate-600">{text}</p>
            </div>
          ))}
        </section>

        <footer className="flex flex-col items-center gap-2 pb-6 pt-2 text-center">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Live Wolof speech model · Enterprise customers, balances and scripted replies are mocked
          </p>
          <Link
            href="/console"
            className="inline-flex items-center gap-1 text-xs font-medium text-navy-700 hover:text-navy-950"
          >
            For enterprise teams: open the operations console <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </footer>
      </main>
    </div>
  );
}
