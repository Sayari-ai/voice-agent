const ASR_API_URL = process.env.ASR_API_URL ?? "https://asr.afriklang.com";

const LANGS = new Set(["wo"]);

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const lang = String(form.get("lang") ?? "wo");

  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "Audio file is required" }, { status: 400 });
  }
  if (!LANGS.has(lang)) {
    return Response.json({ error: `Unsupported language: ${lang}` }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("file", file, file instanceof File ? file.name : "audio.webm");

  const res = await fetch(`${ASR_API_URL}/transcribe/${lang}`, {
    method: "POST",
    body: upstream,
  });

  if (!res.ok) {
    return Response.json({ error: `ASR service error (${res.status})` }, { status: 502 });
  }

  return Response.json(await res.json());
}
