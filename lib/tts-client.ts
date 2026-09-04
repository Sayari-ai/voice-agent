const cache = new Map<string, Promise<Blob>>();
const MAX_ENTRIES = 20;

export interface TtsResult {
  blob: Blob;
  cached: boolean;
}

export function fetchTts(text: string, lang = "wo"): Promise<TtsResult> {
  const key = `${lang}:${text}`;
  const hit = cache.get(key);
  if (hit) return hit.then((blob) => ({ blob, cached: true }));

  const pending = (async () => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
    });
    if (!res.ok) throw new Error(`TTS ${res.status}`);
    return res.blob();
  })();

  cache.set(key, pending);
  pending.catch(() => cache.delete(key));
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return pending.then((blob) => ({ blob, cached: false }));
}
