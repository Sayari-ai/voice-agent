# Guide d'intégration — Agent vocal Afriklang (voice-to-voice)

Ce document est **autonome et exhaustif** : il permet à n'importe quel développeur
front (web, mobile, desktop) d'intégrer l'agent vocal conversationnel wolof/twi
d'Afriklang, sans connaître le code serveur. Il couvre l'ensemble de la pipeline,
le protocole exact, l'orchestration côté client, et des implémentations de référence
(navigateur + Node/Python).

> Deux modes d'intégration existent :
> 1. **`WS /converse/{lang}`** — agent **temps réel** (streaming, barge-in). C'est le
>    mode recommandé pour une expérience « voice-to-voice » fluide. **Ce guide se
>    concentre dessus.**
> 2. **`POST /agent/{lang}`** — agent **tour par tour** (une requête HTTP = un tour).
>    Plus simple, sans micro streaming, décrit en [§9](#9-alternative-simple--post-agentlang).

---

## Table des matières

1. [Vue d'ensemble de la pipeline](#1-vue-densemble-de-la-pipeline)
2. [Ce que le front doit faire (et ne pas faire)](#2-ce-que-le-front-doit-faire-et-ne-pas-faire)
3. [Format audio — la règle absolue](#3-format-audio--la-règle-absolue)
4. [Protocole WebSocket `/converse` (référence exacte)](#4-protocole-websocket-converse-référence-exacte)
5. [Machine à états et orchestration côté client](#5-machine-à-états-et-orchestration-côté-client)
6. [Implémentation navigateur (JS/TypeScript) complète](#6-implémentation-navigateur-jstypescript-complète)
7. [Implémentation Node.js / Python](#7-implémentation-nodejs--python)
8. [Sessions, mémoire et multi-tours](#8-sessions-mémoire-et-multi-tours)
9. [Alternative simple : `POST /agent/{lang}`](#9-alternative-simple--post-agentlang)
10. [Endpoints utilitaires (health, ASR, TTS)](#10-endpoints-utilitaires-health-asr-tts)
11. [Latence, performances et attentes](#11-latence-performances-et-attentes)
12. [Gestion des erreurs et reconnexion](#12-gestion-des-erreurs-et-reconnexion)
13. [Sécurité et déploiement front](#13-sécurité-et-déploiement-front)
14. [Checklist d'intégration](#14-checklist-dintégration)

---

## 1. Vue d'ensemble de la pipeline

L'agent est un pipeline **voice-to-voice** entièrement orchestré **côté serveur**.
Le front n'a qu'à streamer le micro et jouer l'audio reçu.

```
   FRONT (navigateur/app)                    SERVEUR Afriklang (asr.afriklang.com)
 ┌───────────────────────┐                 ┌──────────────────────────────────────┐
 │  Micro                │  PCM 16 kHz     │  1. VAD (détection début/fin parole) │
 │   └─► capture ────────┼───binaire WS──► │  2. ASR Whisper  (audio → texte local)│
 │                       │                 │  3. LLM RodiumAI (texte → réponse même│
 │  Haut-parleur         │  JSON + WAV     │     langue, streamé phrase par phrase)│
 │   ◄─── lecture ◄──────┼───binaire WS──  │  4. TTS (chaque phrase → WAV)         │
 │                       │                 │  5. Barge-in : si tu reparles, le tour│
 └───────────────────────┘                 │     en cours est annulé (drop total)  │
                                           └──────────────────────────────────────┘
```

Points clés :

- **Le VAD (Voice Activity Detection) est côté serveur.** Le front n'a pas à détecter
  les silences ni à découper la parole : il envoie un flux continu, le serveur décide
  quand un tour de parole commence et se termine.
- **Le LLM est streamé par phrase.** Dès qu'une phrase de la réponse est prête, elle
  est synthétisée (TTS) et envoyée. Le front reçoit donc plusieurs bouts d'audio par
  tour, à jouer **dans l'ordre d'arrivée**.
- **Barge-in natif.** Si l'utilisateur reparle pendant que l'agent répond, le serveur
  annule le tour en cours et émet `interrupted`. Le front doit **arrêter la lecture
  audio en cours** à ce signal.
- **Flux direct sans traduction.** Le LLM reçoit et répond dans la langue locale
  (wolof/twi). Il n'y a pas de pivot par le français.

---

## 2. Ce que le front doit faire (et ne pas faire)

| Le front DOIT | Le front NE DOIT PAS |
|---------------|----------------------|
| Capturer le micro et le convertir en **PCM 16 kHz, int16 little-endian, mono** | Envoyer du WebM/Opus/MP3 brut sur `/converse` (le WS attend du PCM brut) |
| Envoyer ce PCM en **frames binaires** au fil de l'eau (chunks ~20–200 ms) | Attendre la fin de l'enregistrement pour tout envoyer d'un coup |
| Envoyer un flux **continu** (y compris pendant les silences) | Faire sa propre détection de fin de parole (c'est le rôle du serveur) |
| Recevoir les **frames binaires** (WAV) et les jouer dans l'ordre | Décoder soi-même l'audio agent avec un format supposé (c'est du WAV auto-portant) |
| Réagir à `interrupted` en **stoppant la lecture** en cours | Continuer à jouer l'audio d'un tour annulé |
| Renvoyer le `session_id` reçu pour garder le contexte multi-tours | Générer soi-même le `session_id` (le serveur en fournit un) |

---

## 3. Format audio — la règle absolue

Le WebSocket `/converse` attend, en **entrée**, exactement :

| Paramètre | Valeur |
|-----------|--------|
| Encodage | **PCM linéaire signé 16 bits** (`int16`) |
| Endianness | **little-endian** |
| Fréquence | **16 000 Hz** |
| Canaux | **1 (mono)** |
| Transport | **frames binaires WebSocket** (pas de base64, pas d'en-tête WAV) |

Le message `ready` du serveur le rappelle : `"format": "pcm s16le 16kHz mono"`.

En **sortie**, l'audio de l'agent (TTS) arrive en **frames binaires**, chacune étant
un **fichier WAV complet et auto-portant** (avec en-tête). Une frame = une phrase.
- Wolof : WAV **16 kHz**.
- Twi : WAV **48 kHz** (l'en-tête WAV porte le sample rate ; le lecteur s'adapte).

> **Rééchantillonnage** : les micros navigateur tournent souvent à 44,1/48 kHz. Il
> faut **rééchantillonner à 16 kHz** avant l'envoi. La méthode robuste en navigateur
> est de créer l'`AudioContext` directement à `sampleRate: 16000` (voir §6).

---

## 4. Protocole WebSocket `/converse` (référence exacte)

**URL** : `wss://asr.afriklang.com/converse/{lang}` où `{lang}` ∈ `wo` | `twi`.

### 4.1 Client → serveur

| Type de message | Contenu | Rôle |
|-----------------|---------|------|
| **binaire** | PCM s16le 16 kHz mono | Le flux micro (le cœur) |
| **texte JSON** | `{"type":"config", ...}` | Configuration de session (optionnel, à envoyer en 1er) |
| **texte** | `stop` | Ferme proprement la connexion |

Message de config (tous les champs sont optionnels) :

```json
{
  "type": "config",
  "session_id": "abc123...",   // pour reprendre une conversation existante
  "gender": "female",          // "female" (défaut) ou "male" (wolof, expérimental)
  "model": "anthropic/claude-haiku-4-5-20251001"  // surcharge du modèle LLM
}
```

> Envoyer la config **avant** de streamer l'audio. Sans config, les valeurs par défaut
> s'appliquent (`gender=female`, modèle serveur par défaut, nouveau `session_id`).

### 4.2 Serveur → client

Messages **texte JSON** (tous ont une clé `type`) :

| `type` | Champs | Signification |
|--------|--------|---------------|
| `ready` | `language`, `model`, `format` | Connexion prête. `format` = `"pcm s16le 16kHz mono"` |
| `speech_start` | — | Le serveur a détecté le **début** de ta parole |
| `speech_end` | `empty` (bool) | Fin de parole. `empty:true` = rien d'exploitable transcrit (segment ignoré) |
| `user_transcript` | `text`, `language` | Ce que tu as dit, transcrit (langue locale) |
| `agent_text` | `delta` | **Une phrase** de la réponse de l'agent (texte) |
| `turn_done` | `session_id` | Fin du tour. Mémorise `session_id` pour le tour suivant |
| `interrupted` | — | **Barge-in** : le tour en cours a été annulé (stoppe la lecture) |
| `error` | `error` (string) | Erreur (voir [§12](#12-gestion-des-erreurs-et-reconnexion)) |

Messages **binaires** :

| Contenu | Signification |
|---------|---------------|
| WAV complet | Le TTS d'**une phrase**. Arrive **juste après** l'`agent_text` correspondant. À jouer dans l'ordre. |

### 4.3 Séquence typique d'un tour

```
Client                          Serveur
  │ ── config (JSON) ─────────► │
  │ ◄──────────── ready ──────  │
  │ ── PCM… PCM… PCM… ────────► │   (flux micro continu)
  │ ◄────── speech_start ─────  │   (parole détectée)
  │ ── PCM… PCM… (silence) ───► │
  │ ◄──── user_transcript ────  │   {"text":"Naka nga def"}
  │ ◄────── agent_text ───────  │   {"delta":"Maa ngi fi rekk."}
  │ ◄════ [WAV binaire #1] ═══  │   (jouer phrase 1)
  │ ◄────── agent_text ───────  │   {"delta":"Yow, naka nga def?"}
  │ ◄════ [WAV binaire #2] ═══  │   (jouer phrase 2)
  │ ◄─────── turn_done ───────  │   {"session_id":"..."}
```

### 4.4 Séquence avec barge-in

```
  │ ◄────── agent_text ───────  │   (l'agent commence à répondre)
  │ ◄════ [WAV binaire #1] ═══  │   (le front joue…)
  │ ── PCM (l'user reparle) ──► │
  │ ◄────── interrupted ──────  │   ← STOPPER la lecture audio immédiatement
  │ ◄────── speech_start ─────  │   (nouveau tour commence)
  │ ◄──── user_transcript ────  │   …
```

---

## 5. Machine à états et orchestration côté client

Le serveur maintient sa propre machine à états (`LISTENING → THINKING → SPEAKING`),
mais le **front doit maintenir la sienne** pour piloter l'UI et la lecture audio.

État recommandé côté front :

```
IDLE ──(connexion + ready)──► LISTENING
LISTENING ──(speech_start)──► LISTENING (afficher "écoute…")
LISTENING ──(user_transcript)──► THINKING (afficher la transcription + spinner)
THINKING ──(1er agent_text)──► SPEAKING (masquer spinner, jouer l'audio)
SPEAKING ──(WAV binaires)──► SPEAKING (enfiler et jouer dans l'ordre)
SPEAKING ──(turn_done)──► LISTENING (tour terminé, prêt pour le suivant)
* ──(interrupted)──► LISTENING (VIDER la file audio + stopper la lecture)
* ──(error)──► gérer (voir §12)
```

**Règle d'or de la lecture audio** : maintenir une **file (queue) de lecture**. Chaque
WAV reçu est mis en file ; un lecteur consomme la file séquentiellement. À `interrupted`
(ou nouveau `speech_start` pendant `SPEAKING`), **vider la file et couper la source
audio en cours**.

---

## 6. Implémentation navigateur (JS/TypeScript) complète

Exemple **prêt à l'emploi**, sans dépendance, utilisant `AudioWorklet` pour capturer
le micro directement en 16 kHz et un `AudioContext` pour la lecture.

### 6.1 Capture micro → PCM 16 kHz (AudioWorklet)

`pcm-worklet.js` (fichier servi statiquement) :

```js
// pcm-worklet.js — convertit les samples float32 [-1,1] en int16 et les poste au main thread
class PCMWorklet extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const f32 = input[0];                 // mono, déjà à sampleRate du contexte
      const i16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) {
        let s = Math.max(-1, Math.min(1, f32[i]));
        i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.port.postMessage(i16.buffer, [i16.buffer]);
    }
    return true;
  }
}
registerProcessor("pcm-worklet", PCMWorklet);
```

### 6.2 Client complet

```js
class AfriklangVoiceAgent {
  constructor({ url = "wss://asr.afriklang.com", lang = "wo", gender = "female" } = {}) {
    this.url = url; this.lang = lang; this.gender = gender;
    this.ws = null;
    this.sessionId = null;
    this.state = "IDLE";
    this.playQueue = [];        // WAV en attente de lecture
    this.playing = false;
    this.currentSource = null;  // AudioBufferSourceNode en cours (pour couper au barge-in)
    this.onEvent = () => {};    // callback UI : (type, payload) => void
  }

  async start() {
    // 1) AudioContext de CAPTURE forcé à 16 kHz : le worklet reçoit déjà du 16 kHz.
    this.captureCtx = new AudioContext({ sampleRate: 16000 });
    await this.captureCtx.audioWorklet.addModule("pcm-worklet.js");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    const src = this.captureCtx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(this.captureCtx, "pcm-worklet");
    src.connect(node);
    // node non connecté à destination : on ne veut pas s'entendre.

    // 2) AudioContext de LECTURE (séparé).
    this.playCtx = new AudioContext();

    // 3) WebSocket.
    this.ws = new WebSocket(`${this.url}/converse/${this.lang}`);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      const cfg = { type: "config", gender: this.gender };
      if (this.sessionId) cfg.session_id = this.sessionId;
      this.ws.send(JSON.stringify(cfg));
      // dès que le WS est ouvert, on pousse le micro
      node.port.onmessage = (e) => {
        if (this.ws.readyState === WebSocket.OPEN) this.ws.send(e.data); // ArrayBuffer PCM
      };
    };

    this.ws.onmessage = (e) => this._onMessage(e.data);
    this.ws.onerror = (e) => this.onEvent("ws_error", e);
    this.ws.onclose = () => { this.state = "IDLE"; this.onEvent("closed"); };
  }

  _onMessage(data) {
    if (data instanceof ArrayBuffer) {            // WAV binaire d'une phrase
      this._enqueueAudio(data);
      return;
    }
    const msg = JSON.parse(data);
    this.onEvent(msg.type, msg);
    switch (msg.type) {
      case "ready":          this.state = "LISTENING"; break;
      case "speech_start":
        // si l'utilisateur reparle pendant qu'on joue : couper (barge-in local anticipé)
        if (this.state === "SPEAKING") this._stopPlayback();
        break;
      case "user_transcript": this.state = "THINKING"; break;
      case "agent_text":      this.state = "SPEAKING"; break;
      case "turn_done":       this.sessionId = msg.session_id; this.state = "LISTENING"; break;
      case "interrupted":     this._stopPlayback(); this.state = "LISTENING"; break;
      case "error":           this.onEvent("error", msg); break;
    }
  }

  async _enqueueAudio(arrayBuffer) {
    // décode le WAV (l'en-tête porte le sample rate → pas d'hypothèse à faire)
    const buf = await this.playCtx.decodeAudioData(arrayBuffer.slice(0));
    this.playQueue.push(buf);
    if (!this.playing) this._playNext();
  }

  _playNext() {
    if (this.playQueue.length === 0) { this.playing = false; this.currentSource = null; return; }
    this.playing = true;
    const buf = this.playQueue.shift();
    const src = this.playCtx.createBufferSource();
    src.buffer = buf;
    src.connect(this.playCtx.destination);
    src.onended = () => this._playNext();
    this.currentSource = src;
    src.start();
  }

  _stopPlayback() {
    this.playQueue = [];
    if (this.currentSource) { try { this.currentSource.stop(); } catch (_) {} this.currentSource = null; }
    this.playing = false;
  }

  stop() {
    try { this.ws && this.ws.send("stop"); } catch (_) {}
    this._stopPlayback();
    this.captureCtx && this.captureCtx.close();
    this.playCtx && this.playCtx.close();
    this.ws && this.ws.close();
  }
}
```

### 6.3 Utilisation

```js
const agent = new AfriklangVoiceAgent({ lang: "wo", gender: "female" });
agent.onEvent = (type, payload) => {
  if (type === "user_transcript") showUser(payload.text);
  if (type === "agent_text")      showAgent(payload.delta);
  if (type === "interrupted")     showInterrupted();
  if (type === "error")           showError(payload.error);
};
await agent.start();   // demande la permission micro et se connecte
// … agent.stop() pour terminer
```

> **HTTPS obligatoire** : `getUserMedia` (micro) exige un contexte sécurisé (HTTPS ou
> `localhost`). En HTTP sur IP distante, le micro est bloqué par le navigateur.

---

## 7. Implémentation Node.js / Python

Pour un backend, un bot, ou des tests, tu peux streamer un fichier ou un flux audio.

### 7.1 Python (référence)

Un client complet et testé est fourni : **[`examples/converse_client.py`](../examples/converse_client.py)**.
Il streame un WAV 16 kHz mono en simulant un micro temps réel, gère la réception des
événements + WAV, et peut déclencher un barge-in. Usage :

```bash
python examples/converse_client.py mon_audio.wav \
  --lang wo --url wss://asr.afriklang.com --gender female \
  --barge interruption.wav        # optionnel : teste le barge-in
```

Extrait de l'essentiel (envoi temps réel + réception) :

```python
import asyncio, json, wave, numpy as np, websockets

SR, CHUNK_MS = 16000, 100

def load_pcm16(path):                 # WAV → PCM int16 mono 16 kHz
    with wave.open(path, "rb") as w:
        raw = w.readframes(w.getnframes()); a = np.frombuffer(raw, np.int16)
    return a.tobytes()

async def main(path):
    async with websockets.connect("wss://asr.afriklang.com/converse/wo", max_size=None) as ws:
        await ws.send(json.dumps({"type": "config", "gender": "female"}))

        async def recv():
            async for m in ws:
                if isinstance(m, (bytes, bytearray)):
                    print("audio phrase", len(m), "octets")            # WAV auto-portant
                else:
                    e = json.loads(m); print(e["type"], e.get("text") or e.get("delta") or "")

        task = asyncio.create_task(recv())
        pcm = load_pcm16(path); step = int(SR * CHUNK_MS / 1000) * 2
        for i in range(0, len(pcm), step):
            await ws.send(pcm[i:i+step]); await asyncio.sleep(CHUNK_MS/1000)
        await ws.send(b"\x00" * step * 15)     # ~1,5 s de silence → clôt le tour (VAD)
        await asyncio.sleep(5); await ws.send("stop"); await task

asyncio.run(main("mon_audio.wav"))
```

### 7.2 Node.js

```js
import WebSocket from "ws";
import fs from "fs";

const ws = new WebSocket("wss://asr.afriklang.com/converse/wo");
ws.on("open", () => {
  ws.send(JSON.stringify({ type: "config", gender: "female" }));
  const pcm = fs.readFileSync("audio_16k_mono.pcm");   // PCM s16le brut
  const CHUNK = 16000 * 0.1 * 2;                        // 100 ms
  let i = 0;
  const timer = setInterval(() => {
    if (i >= pcm.length) { clearInterval(timer); ws.send(Buffer.alloc(CHUNK * 15)); return; }
    ws.send(pcm.subarray(i, i + CHUNK)); i += CHUNK;
  }, 100);
});
ws.on("message", (data, isBinary) => {
  if (isBinary) { console.log("WAV phrase", data.length); return; }  // à jouer
  console.log(JSON.parse(data.toString()));
});
```

---

## 8. Sessions, mémoire et multi-tours

- Au **premier tour**, ne fournis pas de `session_id`. Le serveur en génère un et le
  renvoie dans le premier `turn_done` (et dans chaque suivant).
- **Mémorise ce `session_id`** et repasse-le dans la config si tu ouvres une nouvelle
  connexion, pour **conserver le contexte** de la conversation.
- Sur une **même connexion WS**, le contexte est conservé automatiquement d'un tour à
  l'autre — pas besoin de renvoyer le `session_id` entre deux tours d'une même session.
- La mémoire serveur est **transactionnelle** : un couple `(utilisateur, agent)` n'est
  enregistré **qu'après une réponse réussie**. Un échec/refus LLM ne corrompt pas
  l'historique. Tu n'as rien à gérer côté client pour ça.
- **Durée de vie** : les sessions expirent après **1 heure d'inactivité** et sont
  perdues au redémarrage du serveur (mémoire volatile, pas de persistance). Si tu as
  besoin d'un historique durable, stocke-le côté ton application.
- **Fenêtre de contexte** : le serveur conserve les ~10 derniers tours (20 messages).

---

## 9. Alternative simple : `POST /agent/{lang}`

Si tu n'as pas besoin du temps réel (pas de streaming micro, pas de barge-in), un
endpoint HTTP **tour par tour** existe : tu envoies un fichier audio complet, tu
reçois texte + audio.

**Requête** — `POST /agent/{wo|twi}`, `multipart/form-data` :

| Champ | Type | Rôle | Défaut |
|-------|------|------|--------|
| `file` | fichier | Audio de l'énoncé (webm/wav/mp3… décodé par ffmpeg côté serveur) | requis |
| `session_id` | texte | Vide au 1er tour → le serveur en génère un. À repasser ensuite | vide |
| `gender` | texte | `female` / `male` (voix TTS wolof) | `female` |
| `model` | texte | Modèle LLM à surcharger | défaut serveur |

**Réponse** — JSON :

```json
{
  "language": "wo",
  "session_id": "abc123...",
  "text": "Naka nga def",                         // ce que l'utilisateur a dit
  "response_text": "Maa ngi fi rekk, yow nak?",   // réponse de l'agent
  "model": "anthropic/claude-haiku-4-5-20251001",
  "audio_base64": "UklGR... (WAV encodé base64)"
}
```

Exemple :

```bash
curl -X POST https://asr.afriklang.com/agent/wo \
  -F "file=@question.webm" \
  -F "session_id=" \
  -F "gender=female"
```

Côté front, décoder `audio_base64` (WAV) et le jouer. Pour le tour suivant, renvoyer
le `session_id` reçu.

> Ce mode est **plus lent en ressenti** (une seule réponse à la fin, pas de streaming
> phrase par phrase) mais bien plus simple à intégrer. Utilise `/converse` pour une
> vraie expérience conversationnelle.

---

## 10. Endpoints utilitaires (health, ASR, TTS)

### `GET /health`
Vérifie que le service et les modèles sont chargés (utile pour un readiness check
avant d'ouvrir le WS — cold start possible).

```json
{
  "status": "ok",
  "device": "cuda",
  "models":     { "wo": {"name":"afriklang_asr_wo1","loaded":true}, "twi": {...} },
  "tts_models": { "wo": {"name":"afriklang_wolof_ttsv1","loaded":true}, "twi": {...} }
}
```

### `POST /transcribe/{wo|twi}` — ASR seul (fichier)
`multipart` (`file`) → `{ "text": "...", "language": "wo", "model": "..." }`.

### `WS /transcribe/live/{wo|twi}` — ASR seul en streaming
Même format audio d'entrée que `/converse` (PCM s16le 16 kHz mono, frames binaires).
Messages serveur : `ready`, `speech_start`, `transcript` (`{text, final}`). Pas de LLM
ni de TTS — utile pour de la dictée pure.

### `POST /tts/{wo|twi}` — TTS seul (texte → audio)
Attend du **JSON** (pas du multipart) :

```bash
curl -X POST https://asr.afriklang.com/tts/wo \
  -H "Content-Type: application/json" \
  -d '{"text": "Nanga def?", "gender": "female"}' \
  --output out.wav
```

Réponse : flux `audio/wav` (wolof 16 kHz, twi 48 kHz).

---

## 11. Latence, performances et attentes

| Étape | Ordre de grandeur (à chaud) | Note |
|-------|-----------------------------|------|
| Fin de parole → transcription (ASR) | quelques centaines de ms | Whisper sur GPU |
| Premier token LLM (TTFT) | ~1,7 – 3,2 s | dominé par le prefill amont |
| TTS wolof (SpeechT5) | ~1,7 s / phrase | fluide |
| **TTS twi (VoxCPM)** | **~12,5 s / phrase** | **goulot connu**, en cours d'optimisation |
| Cold start du service | ~3 min | chargement des modèles (502/504 transitoires) |

Conséquences pour le front :
- Le **streaming par phrase** fait que le premier son arrive dès la première phrase
  prête, sans attendre toute la réponse — masque une partie de la latence.
- Prévoir un **indicateur « réflexion »** entre `user_transcript` et le premier
  `agent_text`.
- Sur **twi**, prévenir l'utilisateur d'une latence TTS plus élevée (ou privilégier
  le wolof pour les démos temps réel).
- **Endpointing** : le serveur attend ~900 ms de silence pour clôturer un tour
  (`/converse`). C'est volontairement tolérant pour ne pas couper une phrase sur une
  pause naturelle. Ne pas s'attendre à une réaction instantanée dès l'arrêt de la voix.

---

## 12. Gestion des erreurs et reconnexion

### Codes de fermeture WebSocket

| Code | Cause | Action front |
|------|-------|--------------|
| `4004` | Agent non disponible pour cette langue (modèle non chargé) | Vérifier `/health`, réessayer plus tard |
| `4003` | `RODIUM_API_KEY` non configurée côté serveur | Erreur serveur : contacter l'opérateur |
| fermeture normale | `stop` envoyé ou fin de session | — |

### Messages `error`
Un `{"type":"error","error":"..."}` peut arriver **sans** fermer la connexion (ex.
« réponse LLM vide »). Le front doit l'afficher et rester prêt pour un nouveau tour.

### Bonnes pratiques
- **Readiness** : appeler `GET /health` avant d'ouvrir le WS ; si `loaded:false` ou
  502/504, attendre (cold start).
- **Reconnexion** : sur `onclose` inattendu, rouvrir le WS avec un backoff exponentiel
  et **repasser le `session_id`** mémorisé pour reprendre la conversation.
- **Keep-alive** : envoyer du PCM (même du silence) maintient la connexion active. En
  cas d'inactivité prolongée côté client, prévoir un ping applicatif ou fermer/rouvrir.

---

## 13. Sécurité et déploiement front

- **HTTPS/WSS obligatoire** pour le micro (`getUserMedia`) et pour l'API en production.
  L'ALB termine le TLS ; utilise toujours `https://` / `wss://`.
- **CORS** : l'API autorise actuellement toutes les origines (`*`). Le WS est
  appelable directement depuis le navigateur.
- **Pas d'authentification actuellement** sur l'API : n'expose pas l'URL publiquement
  sans contrôle si tu veux limiter l'usage (chaque tour consomme un appel LLM facturé).
  Une authentification par clé API est prévue côté serveur — prévoir un en-tête
  `X-API-Key` dans ton client si/quand elle est activée.
- **Ne mets aucune clé serveur (RodiumAI, etc.) dans le front.** Le front ne
  manipule que l'audio ; toute la logique LLM/clé reste côté serveur.

---

## 14. Checklist d'intégration

- [ ] Micro capturé et converti en **PCM s16le 16 kHz mono**.
- [ ] Audio envoyé en **frames binaires** au fil de l'eau (chunks ~100 ms), flux continu.
- [ ] Message `config` envoyé en premier (gender, session_id si repris).
- [ ] Réception : distinguer **binaire (WAV à jouer)** et **texte (JSON d'événement)**.
- [ ] File de lecture audio séquentielle, dans l'ordre d'arrivée.
- [ ] `interrupted` (et `speech_start` pendant lecture) → **vider la file + couper le son**.
- [ ] `session_id` de `turn_done` mémorisé pour le multi-tours / reconnexion.
- [ ] UI d'états : écoute → transcription → réflexion → réponse.
- [ ] Gestion des `error` sans fermer, et des codes de fermeture `4003/4004`.
- [ ] Readiness via `GET /health` + reconnexion avec backoff.
- [ ] HTTPS/WSS partout ; aucune clé serveur dans le front.

---

Pour l'architecture interne du serveur, voir [ARCHITECTURE.md](ARCHITECTURE.md) ;
pour le déploiement/exploitation, [DEPLOYMENT.md](DEPLOYMENT.md) ; pour la sécurité,
[SECURITY.md](SECURITY.md).
</content>
</invoke>