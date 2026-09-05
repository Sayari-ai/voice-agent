"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bot,
  PhoneCall,
  PhoneOff,
  ShieldAlert,
  User,
} from "lucide-react";
import { Card, CardHeader, Chip } from "@/components/ui";
import { Waveform } from "@/components/live/waveform";
import { decide, type AgentDecision } from "@/lib/wolof-agent";
import { ConverseSession, type ConverseState } from "@/lib/converse-client";
import { saveSimCall } from "@/lib/sim-history";
import { useSpeechHealth } from "@/lib/use-speech-health";

type CallPhase = ConverseState | "ended";

interface Entry {
  id: number;
  role: "customer" | "agent" | "event";
  wolof?: string;
  text?: string;
}

interface LogItem {
  id: number;
  time: string;
  text: string;
  tone: "gray" | "green" | "amber" | "red";
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const now = () =>
  new Date().toLocaleTimeString("en-GB", { hour12: false, minute: "2-digit", second: "2-digit" });

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
      </div>
    </div>
  );
}

export function CustomerSimulator() {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [log, setLog] = useState<LogItem[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [lastDecision, setLastDecision] = useState<AgentDecision | null>(null);
  const health = useSpeechHealth();

  const session = useRef<ConverseSession | null>(null);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0);
  const lastIntent = useRef("abandoned");
  const escalated = useRef(false);
  const agentEntry = useRef<number | null>(null);
  const hadTurn = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries.length]);

  useEffect(() => () => session.current?.stop(), []);

  const inCall = phase !== "idle" && phase !== "ended";

  useEffect(() => {
    if (!inCall) return;
    const t = setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [inCall]);

  const startCall = () => {
    if (inCall) return;
    session.current?.stop();
    setEntries([]);
    setLog([]);
    setLastDecision(null);
    setSeconds(0);
    setPlaying(false);
    startedAt.current = Date.now();
    lastIntent.current = "abandoned";
    escalated.current = false;
    agentEntry.current = null;
    hadTurn.current = false;

    const addLog = (text: string, tone: LogItem["tone"] = "gray") =>
      setLog((prev) => [...prev.slice(-30), { id: nextId.current++, time: now(), text, tone }]);
    const addEntry = (e: Omit<Entry, "id">) => {
      const id = nextId.current++;
      setEntries((prev) => [...prev, { ...e, id }]);
      return id;
    };
    const saveSummary = () => {
      if (!hadTurn.current) return;
      hadTurn.current = false;
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
        intent: lastIntent.current,
        duration: fmtTime(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))),
        outcome: escalated.current ? "Escalated" : "Resolved",
      });
    };

    if (health.status === "offline") {
      addLog("Speech service looks offline — trying anyway (cold start can take ~3 min)", "amber");
    }

    const s = new ConverseSession({
      onState: (st) => setPhase(st === "idle" ? "ended" : st),
      onPlaying: setPlaying,
      onReady: (model) => {
        addLog(`Connected · ${model} · server VAD + barge-in`, "green");
        addEntry({
          role: "event",
          text: "Live call connected speak Wolof, the agent listens hands-free",
        });
      },
      onSpeechStart: () => addLog("Speech detected"),
      onEmptyTurn: () => addLog("Segment had no usable speech still listening", "amber"),
      onUserTranscript: (text) => {
        hadTurn.current = true;
        agentEntry.current = null;
        addEntry({ role: "customer", wolof: text });
        const d = decide(text);
        lastIntent.current = d.intent;
        if (d.risk === "high" || d.intent === "human_handoff") escalated.current = true;
        setLastDecision(d);
        addLog(
          `Transcript · intent: ${d.label} · risk ${d.risk}`,
          d.risk === "high" ? "red" : "green"
        );
      },
      onAgentText: (delta) => {
        const id = agentEntry.current;
        if (id == null) {
          agentEntry.current = addEntry({ role: "agent", wolof: delta });
        } else {
          setEntries((prev) =>
            prev.map((e) => (e.id === id ? { ...e, wolof: `${e.wolof ?? ""} ${delta}`.trim() } : e))
          );
        }
      },
      onAgentAudio: (bytes) =>
        addLog(`TTS sentence streamed · ${Math.round(bytes / 1024)} KB`, "green"),
      onTurnDone: (sid) => {
        agentEntry.current = null;
        addLog(`Turn complete · session ${sid.slice(0, 8)}…`);
      },
      onInterrupted: () => {
        agentEntry.current = null;
        addLog("Barge-in — agent stopped, listening to you", "amber");
      },
      onMicError: () => {
        setPhase("idle");
        addLog("Microphone permission denied", "red");
        addEntry({
          role: "event",
          text: "Microphone access is needed check browser permissions",
        });
      },
      onError: (message) => addLog(`Agent error: ${message}`, "red"),
      onReconnecting: (attempt) =>
        addLog(`Connection lost — reconnecting (attempt ${attempt})…`, "amber"),
      onClosed: (expected, reason) => {
        if (!expected && reason) addEntry({ role: "event", text: reason });
        addLog(expected ? "Session ended" : `Session closed: ${reason ?? "unknown"}`,
          expected ? "gray" : "red");
        saveSummary();
      },
    });
    session.current = s;
    void s.start();
  };

  const waveMode = playing || phase === "speaking" ? "agent" : phase === "listening" ? "customer" : "idle";
  const statusLine =
    phase === "idle"
      ? "Start a live call and speak Wolof the agent answers with voice"
      : phase === "connecting"
        ? "Connecting to the live agent…"
        : phase === "listening"
          ? playing
            ? "Agent is finishing its reply — start talking to interrupt"
            : "Listening… speak Wolof, pause and the agent replies"
          : phase === "thinking"
            ? "Heard you — the agent is thinking…"
            : phase === "speaking"
              ? "Agent is replying… start talking any time to interrupt"
              : "Call ended start another live call";

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader
          icon={<PhoneCall className="h-4 w-4" />}
          title="Live customer call"
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
              onClick={() => session.current?.stop()}
              aria-label="End call"
              className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600 text-white transition-all hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-300"
            >
              <PhoneOff className="h-8 w-8" />
            </button>
          ) : (
            <button
              onClick={startCall}
              aria-label="Start live call"
              className="flex h-20 w-20 items-center justify-center rounded-full bg-navy-900 text-white transition-all hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-300"
            >
              <PhoneCall className="h-8 w-8" />
            </button>
          )}
          <div className="w-full max-w-sm">
            <Waveform mode={waveMode} />
          </div>
          <p className="text-xs text-slate-500" aria-live="polite">
            {statusLine}
          </p>
          <p className="text-[11px] text-slate-400">
            Voice-to-voice · ASR → LLM → TTS streamed per sentence · Server VAD + barge-in
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
