const ASR_API_URL = process.env.ASR_API_URL ?? "https://asr.afriklang.com";

interface UpstreamHealth {
  status?: string;
  device?: string;
  models?: Record<string, { name?: string }>;
  tts_models?: Record<string, { name?: string }>;
}

export async function GET() {
  try {
    const res = await fetch(`${ASR_API_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return Response.json({ ok: false }, { status: 502 });
    }
    const data = (await res.json()) as UpstreamHealth;
    return Response.json({
      ok: data.status === "ok",
      device: data.device ?? null,
      asrModel: data.models?.wo?.name ?? null,
      ttsModel: data.tts_models?.wo?.name ?? null,
    });
  } catch {
    return Response.json({ ok: false }, { status: 502 });
  }
}
