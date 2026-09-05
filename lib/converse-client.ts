// Client for the Afriklang real-time voice agent (WS /converse/{lang}).
// Protocol: send a JSON config first, then stream mic PCM s16le 16 kHz mono as
// binary frames; receive JSON events + one self-contained WAV per agent sentence.
// See INTEGRATION.md §4–6.

const WS_BASE = process.env.NEXT_PUBLIC_ASR_WS_URL ?? "wss://asr.afriklang.com";
const MAX_RECONNECTS = 3;

export type ConverseState = "idle" | "connecting" | "listening" | "thinking" | "speaking";

type ServerEvent =
  | { type: "ready"; language: string; model: string; format: string }
  | { type: "speech_start" }
  | { type: "speech_end"; empty?: boolean }
  | { type: "user_transcript"; text: string; language?: string }
  | { type: "agent_text"; delta: string }
  | { type: "turn_done"; session_id: string }
  | { type: "interrupted" }
  | { type: "error"; error: string };

export interface ConverseCallbacks {
  onState: (state: ConverseState) => void;
  /** True while agent WAVs are playing (can outlast `turn_done`). */
  onPlaying: (playing: boolean) => void;
  onReady: (model: string) => void;
  onSpeechStart: () => void;
  /** `speech_end` with `empty: true` — nothing usable was transcribed. */
  onEmptyTurn: () => void;
  onUserTranscript: (text: string) => void;
  /** One sentence of the agent reply; its WAV follows as a binary frame. */
  onAgentText: (delta: string) => void;
  onAgentAudio: (bytes: number) => void;
  onTurnDone: (sessionId: string) => void;
  onInterrupted: () => void;
  onMicError: () => void;
  onError: (message: string) => void;
  onReconnecting: (attempt: number) => void;
  onClosed: (expected: boolean, reason: string | null) => void;
}

export interface ConverseOptions {
  lang?: "wo";
  gender?: "female" | "male";
  model?: string;
  /** Resume an existing server-side conversation. */
  sessionId?: string | null;
}

export class ConverseSession {
  private active = false;
  private ws: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private captureCtx: AudioContext | null = null;
  private playCtx: AudioContext | null = null;
  private queue: AudioBuffer[] = [];
  private source: AudioBufferSourceNode | null = null;
  private playing = false;
  private state: ConverseState = "idle";
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly lang: "wo";
  private readonly gender: "female" | "male";
  private readonly model?: string;
  sessionId: string | null;

  constructor(
    private cb: ConverseCallbacks,
    opts: ConverseOptions = {}
  ) {
    this.lang = opts.lang ?? "wo";
    this.gender = opts.gender ?? "female";
    this.model = opts.model;
    this.sessionId = opts.sessionId ?? null;
  }

  get currentState(): ConverseState {
    return this.state;
  }

  async start() {
    if (this.active) return;
    this.active = true;
    this.setState("connecting");

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      this.active = false;
      this.setState("idle");
      this.cb.onMicError();
      return;
    }

    try {
      // Capture context pinned to 16 kHz so the worklet emits ready-to-send PCM.
      this.captureCtx = new AudioContext({ sampleRate: 16000 });
      await this.captureCtx.audioWorklet.addModule("/pcm-worklet.js");
      const src = this.captureCtx.createMediaStreamSource(this.stream);
      const node = new AudioWorkletNode(this.captureCtx, "pcm-worklet");
      src.connect(node); // not connected to destination: no self-monitoring
      node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => this.sendPcm(e.data);
      this.playCtx = new AudioContext();
      await Promise.all([this.captureCtx.resume(), this.playCtx.resume()]);
    } catch {
      this.cb.onError("Audio pipeline failed to start (16 kHz capture unsupported?)");
      this.teardown();
      this.cb.onClosed(false, "Audio setup failed");
      return;
    }

    this.connect();
  }

  /** Graceful shutdown: tells the server to stop, then releases everything. */
  stop() {
    if (!this.active) {
      this.teardown();
      return;
    }
    this.active = false;
    try {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send("stop");
    } catch {
      // socket already gone
    }
    this.teardown();
    this.cb.onClosed(true, null);
  }

  /** Local barge-in: cut agent audio immediately (server confirms via `interrupted`). */
  cutPlayback() {
    this.stopPlayback();
  }

  private connect() {
    const ws = new WebSocket(`${WS_BASE}/converse/${this.lang}`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => {
      this.attempts = 0;
      const cfg: Record<string, string> = { type: "config", gender: this.gender };
      if (this.sessionId) cfg.session_id = this.sessionId;
      if (this.model) cfg.model = this.model;
      ws.send(JSON.stringify(cfg));
    };
    ws.onmessage = (e: MessageEvent<ArrayBuffer | string>) => this.handleMessage(e.data);
    ws.onclose = (e) => this.handleClose(e);
  }

  private sendPcm(buf: ArrayBuffer) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(buf);
  }

  private handleMessage(data: ArrayBuffer | string) {
    if (data instanceof ArrayBuffer) {
      void this.enqueueAudio(data);
      return;
    }
    let msg: ServerEvent;
    try {
      msg = JSON.parse(data) as ServerEvent;
    } catch {
      return;
    }
    switch (msg.type) {
      case "ready":
        this.setState("listening");
        this.cb.onReady(msg.model);
        break;
      case "speech_start":
        // User is talking: cut any agent audio without waiting for `interrupted`.
        if (this.playing) this.stopPlayback();
        this.cb.onSpeechStart();
        break;
      case "speech_end":
        if (msg.empty) this.cb.onEmptyTurn();
        break;
      case "user_transcript":
        this.setState("thinking");
        this.cb.onUserTranscript(msg.text);
        break;
      case "agent_text":
        this.setState("speaking");
        this.cb.onAgentText(msg.delta);
        break;
      case "turn_done":
        this.sessionId = msg.session_id;
        this.setState("listening");
        this.cb.onTurnDone(msg.session_id);
        break;
      case "interrupted":
        this.stopPlayback();
        this.setState("listening");
        this.cb.onInterrupted();
        break;
      case "error":
        this.cb.onError(msg.error);
        break;
    }
  }

  private handleClose(e: CloseEvent) {
    if (!this.active) return; // expected teardown
    if (e.code === 4004 || e.code === 4003) {
      const reason =
        e.code === 4004
          ? "Agent unavailable for this language (model not loaded)"
          : "LLM key not configured on the server";
      this.cb.onError(reason);
      this.active = false;
      this.teardown();
      this.cb.onClosed(false, reason);
      return;
    }
    if (this.attempts < MAX_RECONNECTS) {
      // Unexpected drop: reconnect with backoff, resuming via session_id.
      this.attempts += 1;
      this.setState("connecting");
      this.stopPlayback();
      this.cb.onReconnecting(this.attempts);
      this.reconnectTimer = setTimeout(() => this.connect(), 1000 * 2 ** (this.attempts - 1));
      return;
    }
    this.active = false;
    this.teardown();
    this.cb.onClosed(false, "Connection lost");
  }

  private async enqueueAudio(buf: ArrayBuffer) {
    const ctx = this.playCtx;
    if (!ctx || !this.active) return;
    this.cb.onAgentAudio(buf.byteLength);
    try {
      // Each frame is a self-contained WAV; the header carries the sample rate.
      const audio = await ctx.decodeAudioData(buf.slice(0));
      if (!this.active) return;
      this.queue.push(audio);
      if (!this.playing) this.playNext();
    } catch {
      // undecodable frame — skip
    }
  }

  private playNext() {
    const ctx = this.playCtx;
    const buf = this.queue.shift();
    if (!ctx || !buf) {
      this.source = null;
      this.setPlaying(false);
      return;
    }
    this.setPlaying(true);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => this.playNext();
    this.source = src;
    src.start();
  }

  private stopPlayback() {
    this.queue = [];
    if (this.source) {
      this.source.onended = null;
      try {
        this.source.stop();
      } catch {
        // already stopped
      }
      this.source = null;
    }
    this.setPlaying(false);
  }

  private setState(s: ConverseState) {
    if (this.state === s) return;
    this.state = s;
    this.cb.onState(s);
  }

  private setPlaying(p: boolean) {
    if (this.playing === p) return;
    this.playing = p;
    this.cb.onPlaying(p);
  }

  private teardown() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopPlayback();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        // already closed
      }
      this.ws = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.captureCtx?.close().catch(() => {});
    this.captureCtx = null;
    void this.playCtx?.close().catch(() => {});
    this.playCtx = null;
    this.setState("idle");
  }
}
