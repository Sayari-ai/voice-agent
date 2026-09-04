"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bot,
  Mic,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  ShieldAlert,
  User,
} from "lucide-react";
import { Bar, Card, CardHeader, Chip } from "@/components/ui";
import { Waveform } from "@/components/live/waveform";
import {
  BALANCE_DATA,
  OPENING,
  decide,
  type AgentDecision,
} from "@/lib/wolof-agent";
import { fetchTts } from "@/lib/tts-client";
import { saveSimCall } from "@/lib/sim-history";
import { useSpeechHealth } from "@/lib/use-speech-health";

type CallPhase = "idle" | "opening" | "listening" | "transcribing" | "speaking" | "ended";

interface Entry {
  id: number;
  role: "customer" | "agent" | "event";
  wolof?: string;
  english?: string;
  text?: string;
  card?: "balance" | "handoff";
  handoff?: { queue: string; sla: string; caseId?: string };
}

interface LogItem {
  id: number;
  time: string;
  text: string;
  tone: "gray" | "green" | "amber" | "red";
}

const SPEECH_START = 0.045;
const SPEECH_KEEP = 0.025;
const SILENCE_MS = 1400;
const NO_SPEECH_MS = 9000;
const MAX_TURN_MS = 15000;

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const now = () =>
  new Date().toLocaleTimeString("en-GB", { hour12: false, minute: "2-digit", second: "2-digit" });

function BalanceCard() {
  return (
    <div className="animate-fade-up mr-auto w-full max-w-[85%] rounded-xl border border-gold-200 bg-gold-50/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-navy-700">{BALANCE_DATA.bundle}</p>
        {BALANCE_DATA.autoRenew && <Chip tone="green">Auto-renew on</Chip>}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-navy-950">
        {BALANCE_DATA.remainingGb} GB{" "}
        <span className="text-sm font-normal text-slate-500">remaining</span>
      </p>
      <div className="mt-2">
        <Bar value={(BALANCE_DATA.remainingGb / 10) * 100} />
      </div>
      <p className="mt-2 text-xs text-slate-500">Expires {BALANCE_DATA.expires} · Simulated BSS</p>
    </div>
  );
}

function HandoffCard({ handoff }: { handoff: NonNullable<Entry["handoff"]> }) {
  return (
    <div className="animate-fade-up mr-auto w-full max-w-[85%] rounded-xl border border-red-200 bg-red-50/60 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
        <PhoneForwarded className="h-4 w-4" /> Escalated to a human specialist
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
    </div>
  );
}

function EntryBubble({ entry }: { entry: Entry }) {
  if (entry.role === "event") {
    return (
      <div className="animate-fade-up flex justify-center">
        <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-center text-[11px] text-slate-500">
          {entry.text}
        </span>
      </div>
    );
  }
  if (entry.card === "balance") return <BalanceCard />;
  if (entry.card === "handoff" && entry.handoff) return <HandoffCard handoff={entry.handoff} />;

  const isCustomer = entry.role === "customer";
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
          {isCustomer ? "Customer · Wolof" : "Agent · Wolof"}
        </p>
        <p className="text-sm leading-relaxed text-navy-950">{entry.wolof}</p>
        {entry.english && (
          <p className="mt-1 text-xs italic leading-relaxed text-slate-500">“{entry.english}”</p>
        )}
      </div>
    </div>
  );
}

interface SessionCallbacks {
  onPhase: (p: CallPhase) => void;
  onEntry: (e: Omit<Entry, "id">) => void;
  onLog: (text: string, tone?: LogItem["tone"]) => void;
  onDecision: (d: AgentDecision) => void;
  onEnded: (s: { intent: string; escalated: boolean; durationSec: number }) => void;
}

class CallSession {
  private active = false;
  private phase: CallPhase = "idle";
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vad: ReturnType<typeof setInterval> | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private audio: HTMLAudioElement | null = null;
  private url: string | null = null;
  private emptyTurns = 0;
  private pendingDone: (() => void) | null = null;
  private lastIntent = "abandoned";
  private escalated = false;
  private startedMs = 0;

  constructor(private cb: SessionCallbacks) {}

  private setPhase(p: CallPhase) {
    this.phase = p;
    this.cb.onPhase(p);
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.cb.onLog("Microphone permission denied", "red");
      this.cb.onEntry({
        role: "event",
        text: "Microphone access is needed check browser permissions",
      });
      return;
    }
    this.active = true;
    this.startedMs = Date.now();
    this.setPhase("opening");
    this.cb.onLog("Session started · Language: Wolof (wo) · GPU inference", "green");
    this.cb.onEntry({
      role: "event",
      text: "Simulated customer call · You are the customer speak Wolof",
    });
    this.cb.onEntry({ role: "agent", wolof: OPENING.wolof, english: OPENING.english });
    void this.speak(OPENING.wolof, () => this.listen());
  }

  finishTurn() {
    this.stopVad();
    if (this.rec && this.rec.state !== "inactive") this.rec.stop();
  }

  end(note?: string) {
    if (this.phase === "ended" || this.phase === "idle") return;
    const summary = {
      intent: this.lastIntent,
      escalated: this.escalated,
      durationSec: Math.max(1, Math.round((Date.now() - this.startedMs) / 1000)),
    };
    this.dispose();
    this.setPhase("ended");
    if (note) this.cb.onEntry({ role: "event", text: note });
    this.cb.onLog("Session ended");
    this.cb.onEnded(summary);
  }

  interrupt() {
    if (this.phase !== "speaking" && this.phase !== "opening") return;
    this.cb.onLog("Customer barged in agent audio stopped");
    this.releaseAudio();
    this.finishSpeech();
  }

  dispose() {
    this.active = false;
    this.pendingDone = null;
    this.stopVad();
    if (this.rec && this.rec.state !== "inactive") {
      this.rec.onstop = null;
      this.rec.stop();
    }
    this.rec = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.analyser = null;
    this.releaseAudio();
  }

  private stopVad() {
    if (this.vad) clearInterval(this.vad);
    this.vad = null;
  }

  private releaseAudio() {
    this.audio?.pause();
    this.audio = null;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }

  private listen() {
    const s = this.stream;
    if (!this.active || !s) return;
    this.setPhase("listening");

    if (!this.ctx) {
      this.ctx = new AudioContext();
      const src = this.ctx.createMediaStreamSource(s);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      src.connect(this.analyser);
    }

    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
      MediaRecorder.isTypeSupported(t)
    );
    const rec = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s);
    this.rec = rec;
    this.chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(this.chunks, { type: rec.mimeType || "audio/webm" });
      void this.handleClip(blob);
    };
    rec.start();

    const analyser = this.analyser!;
    const buf = new Uint8Array(analyser.fftSize);
    const startedAt = performance.now();
    let spoke = false;
    let speaking = false;
    let lastVoice = startedAt;

    this.stopVad();
    this.vad = setInterval(() => {
      if (!this.active) return this.finishTurn();
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      const t = performance.now();
      speaking = rms > (speaking ? SPEECH_KEEP : SPEECH_START);
      if (speaking) {
        spoke = true;
        lastVoice = t;
      }
      if (
        (spoke && t - lastVoice > SILENCE_MS) ||
        (!spoke && t - startedAt > NO_SPEECH_MS) ||
        t - startedAt > MAX_TURN_MS
      ) {
        this.finishTurn();
      }
    }, 100);
  }

  private async handleClip(blob: Blob) {
    if (!this.active) return;
    this.setPhase("transcribing");
    const t0 = performance.now();
    try {
      const form = new FormData();
      form.append("file", blob, blob.type.includes("mp4") ? "clip.mp4" : "clip.webm");
      form.append("lang", "wo");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error(`ASR ${res.status}`);
      const data = (await res.json()) as { text: string; model?: string };
      if (!this.active) return;
      const ms = Math.round(performance.now() - t0);
      const text = data.text?.trim();

      if (!text) {
        this.emptyTurns += 1;
        this.cb.onLog(`ASR returned no speech · ${ms} ms`, "amber");
        if (this.emptyTurns >= 3) {
          this.end("No speech detected session closed");
          return;
        }
        if (this.emptyTurns === 2) {
          const d = decide("");
          this.cb.onEntry({ role: "agent", wolof: d.reply.wolof, english: d.reply.english });
          void this.speak(d.reply.wolof, () => this.listen());
          return;
        }
        this.cb.onEntry({ role: "event", text: "Didn’t catch that listening again" });
        this.listen();
        return;
      }

      this.emptyTurns = 0;
      this.cb.onLog(`ASR ${data.model ?? "afriklang_asr_wo1"} · ${ms} ms`, "green");
      this.cb.onEntry({ role: "customer", wolof: text });

      const d = decide(text);
      this.lastIntent = d.intent;
      if (d.handoff) this.escalated = true;
      this.cb.onDecision(d);
      const conf = 72 + ((text.length * 7) % 24);
      this.cb.onLog(
        `Intent: ${d.label} · ${conf}% · risk ${d.risk}`,
        d.risk === "high" ? "red" : "gray"
      );
      if (d.card === "balance") this.cb.onLog("Tool call: get_data_balance · Simulated BSS");
      if (d.card === "handoff") this.cb.onLog(`Escalation: ${d.handoff?.queue}`, "red");

      this.cb.onEntry({
        role: "agent",
        wolof: d.reply.wolof,
        english: d.reply.english,
        card: d.card,
        handoff: d.handoff,
      });

      void this.speak(d.reply.wolof, () => {
        if (d.endsCall) {
          this.end(d.intent === "thanks" ? "Resolved by the assistant" : "Waiting for human pickup");
        } else {
          this.listen();
        }
      });
    } catch {
      this.cb.onLog("ASR unavailable check the speech service", "red");
      this.end("Speech service unavailable session closed");
    }
  }

  private async speak(text: string, onDone: () => void) {
    if (!this.active) return;
    this.setPhase("speaking");
    const t0 = performance.now();
    try {
      const { blob, cached } = await fetchTts(text, "wo");
      if (!this.active) return;
      this.cb.onLog(
        cached
          ? "TTS from cache · instant"
          : `TTS synthesis · ${Math.round(performance.now() - t0)} ms · ${Math.round(blob.size / 1024)} KB`,
        "green"
      );
      this.releaseAudio();
      this.url = URL.createObjectURL(blob);
      const audio = new Audio(this.url);
      this.audio = audio;
      this.pendingDone = onDone;
      audio.onended = () => this.finishSpeech();
      audio.onerror = () => this.finishSpeech();
      await audio.play();
    } catch {
      this.cb.onLog("TTS unavailable continuing without audio", "amber");
      this.pendingDone = null;
      if (this.active) onDone();
    }
  }

  private finishSpeech() {
    const done = this.pendingDone;
    this.pendingDone = null;
    if (this.active && done) done();
  }
}

export function CustomerSimulator() {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [log, setLog] = useState<LogItem[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [lastDecision, setLastDecision] = useState<AgentDecision | null>(null);
  const health = useSpeechHealth();

  const session = useRef<CallSession | null>(null);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries.length]);

  useEffect(() => () => session.current?.dispose(), []);

  const inCall = phase !== "idle" && phase !== "ended";

  useEffect(() => {
    if (!inCall) return;
    const t = setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [inCall]);

  const startCall = () => {
    if (inCall) return;
    session.current?.dispose();
    setEntries([]);
    setLog([]);
    setLastDecision(null);
    setSeconds(0);
    const s = new CallSession({
      onPhase: setPhase,
      onEntry: (e) => setEntries((prev) => [...prev, { ...e, id: nextId.current++ }]),
      onLog: (text, tone = "gray") =>
        setLog((prev) => [...prev.slice(-30), { id: nextId.current++, time: now(), text, tone }]),
      onDecision: setLastDecision,
      onEnded: ({ intent, escalated, durationSec }) =>
        saveSimCall({
          id: `SIM-${String(Date.now()).slice(-5)}`,
          time: new Date().toLocaleTimeString("en-GB", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
          }),
          customer: "You · Simulator",
          org: "Customer Simulator",
          language: "Wolof",
          intent,
          duration: fmtTime(durationSec),
          outcome: escalated ? "Escalated" : "Resolved",
        }),
    });
    session.current = s;
    void s.start();
  };

  const waveMode = phase === "speaking" || phase === "opening" ? "agent" : phase === "listening" ? "customer" : "idle";
  const statusLine =
    phase === "idle"
      ? "Start a simulated call and speak Wolof the agent answers with voice"
      : phase === "opening"
        ? "Agent is greeting the customer…"
        : phase === "listening"
          ? "Listening… pause to let the agent reply, or tap the mic to finish"
          : phase === "transcribing"
            ? "Transcribing on the Afriklang Wolof model…"
            : phase === "speaking"
              ? "Agent is speaking… tap the mic to interrupt"
              : "Call ended start another simulation";

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader
          icon={<PhoneCall className="h-4 w-4" />}
          title="Simulated customer call"
          right={
            <div className="flex items-center gap-2">
              {inCall && <span className="font-mono text-xs text-slate-400">{fmtTime(seconds)}</span>}
              <Chip
                tone={health.status === "online" ? "green" : health.status === "offline" ? "red" : "gray"}
              >
                {health.status === "online"
                  ? `ASR online${health.device === "cuda" ? " · GPU" : ""}`
                  : health.status === "offline"
                    ? "ASR offline"
                    : "Checking ASR…"}
              </Chip>
              <Chip tone={inCall ? "green" : "gray"} pulse={inCall}>
                {inCall ? "Live · Wolof" : "Standby"}
              </Chip>
            </div>
          }
        />

        <div className="flex flex-col items-center gap-2 px-5 py-6">
          {inCall ? (
            <button
              onClick={
                phase === "listening"
                  ? () => session.current?.finishTurn()
                  : phase === "speaking" || phase === "opening"
                    ? () => session.current?.interrupt()
                    : () => session.current?.end("Call ended by supervisor")
              }
              aria-label={
                phase === "listening"
                  ? "Finish speaking"
                  : phase === "speaking" || phase === "opening"
                    ? "Interrupt the agent and speak"
                    : "End call"
              }
              className={`flex h-20 w-20 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-300 ${
                phase === "listening"
                  ? "bg-gold-500 text-navy-950 ring-4 ring-gold-200"
                  : phase === "speaking" || phase === "opening"
                    ? "bg-navy-900 text-white hover:bg-navy-800"
                    : "bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              {phase === "listening" || phase === "speaking" || phase === "opening" ? (
                <Mic className="h-8 w-8" />
              ) : (
                <PhoneOff className="h-8 w-8" />
              )}
            </button>
          ) : (
            <button
              onClick={startCall}
              aria-label="Start simulated call"
              className="flex h-20 w-20 items-center justify-center rounded-full bg-navy-900 text-white transition-all hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-300"
            >
              <PhoneCall className="h-8 w-8" />
            </button>
          )}
          {inCall && (
            <button
              onClick={() => session.current?.end("Call ended by supervisor")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
            >
              <PhoneOff className="h-3.5 w-3.5" /> End call
            </button>
          )}
          <div className="w-full max-w-sm">
            <Waveform mode={waveMode} />
          </div>
          <p className="text-xs text-slate-500" aria-live="polite">
            {statusLine}
          </p>
          <p className="text-[11px] text-slate-400">
            Voice-to-voice · Afriklang Wolof ASR + TTS · Hands-free silence detection
          </p>
        </div>

        {entries.length > 0 && (
          <div
            ref={scrollRef}
            className="max-h-96 space-y-3 overflow-y-auto border-t border-slate-100 px-5 py-4"
            aria-live="polite"
          >
            {entries.map((e) => (
              <EntryBubble key={e.id} entry={e} />
            ))}
          </div>
        )}
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader icon={<Activity className="h-4 w-4" />} title="Pipeline" />
          <div className="max-h-64 space-y-2 overflow-y-auto px-5 py-4">
            {log.length === 0 && (
              <p className="text-xs text-slate-400">Events appear here once a call starts.</p>
            )}
            {log.map((l) => (
              <p key={l.id} className="flex items-start gap-2 text-xs">
                <span className="shrink-0 font-mono text-slate-400">{l.time}</span>
                <span
                  className={
                    l.tone === "green"
                      ? "text-emerald-700"
                      : l.tone === "amber"
                        ? "text-amber-700"
                        : l.tone === "red"
                          ? "text-red-700"
                          : "text-slate-600"
                  }
                >
                  {l.text}
                </span>
              </p>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader icon={<ShieldAlert className="h-4 w-4" />} title="Current intent" />
          <div className="space-y-2 px-5 py-4">
            {lastDecision ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-navy-950">{lastDecision.label}</p>
                  <Chip tone={lastDecision.risk === "high" ? "red" : "green"}>
                    {lastDecision.risk === "high" ? "High risk" : "Low risk"}
                  </Chip>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                  {lastDecision.risk === "high"
                    ? "High-risk requests are always escalated to a human specialist."
                    : "Eligible for autonomous resolution by the agent."}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400">The detected intent will appear here.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Things to try (Wolof)" />
          <ul className="space-y-2 px-5 py-4 text-xs text-slate-600">
            <li>
              <span className="font-medium text-navy-900">“Ñaata data moo ma dess?”</span> data
              balance
            </li>
            <li>
              <span className="font-medium text-navy-900">“Jël nañu sama xaalis”</span> report
              fraud (escalates)
            </li>
            <li>
              <span className="font-medium text-navy-900">“Bëgg naa wax ak nit”</span> ask for a
              human
            </li>
            <li>
              <span className="font-medium text-navy-900">“Jërëjëf”</span> thank &amp; end the
              call
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
