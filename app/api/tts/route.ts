const ASR_API_URL = process.env.ASR_API_URL ?? "https://asr.afriklang.com";

const LANGS = new Set(["wo"]);

export async function POST(req: Request) {
  const { text, lang = "wo" } = (await req.json()) as { text?: string; lang?: string };

  if (!text?.trim()) {
    return Response.json({ error: "Text is required" }, { status: 400 });
  }
  if (!LANGS.has(lang)) {
    return Response.json({ error: `Unsupported language: ${lang}` }, { status: 400 });
  }

  const res = await fetch(`${ASR_API_URL}/tts/${lang}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok || !res.body) {
    return Response.json({ error: `TTS service error (${res.status})` }, { status: 502 });
  }

  return new Response(res.body, {
    headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
  });
}
