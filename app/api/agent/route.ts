const ASR_API_URL = process.env.ASR_API_URL ?? "https://asr.afriklang.com";

const LANGS = new Set(["wo"]);
const GENDERS = new Set(["female", "male"]);

interface AgentResponse {
  language: string;
  session_id: string;
  text: string;
  response_text: string;
  model: string;
  audio_base64: string;
}

// Turn-by-turn voice agent (INTEGRATION.md §9): full audio clip in,
// transcript + LLM reply + WAV (base64) out. session_id keeps multi-turn context.
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const lang = String(form.get("lang") ?? "wo");
  const sessionId = String(form.get("session_id") ?? "");
  const gender = String(form.get("gender") ?? "female");

  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "Audio file is required" }, { status: 400 });
  }
  if (!LANGS.has(lang)) {
    return Response.json({ error: `Unsupported language: ${lang}` }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("file", file, file instanceof File ? file.name : "audio.webm");
  upstream.append("session_id", sessionId);
  upstream.append("gender", GENDERS.has(gender) ? gender : "female");

  const res = await fetch(`${ASR_API_URL}/agent/${lang}`, {
    method: "POST",
    body: upstream,
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    return Response.json({ error: `Agent service error (${res.status})` }, { status: 502 });
  }

  const data = (await res.json()) as AgentResponse;
  return Response.json({
    sessionId: data.session_id,
    text: data.text,
    responseText: data.response_text,
    model: data.model,
    audioBase64: data.audio_base64,
  });
}
