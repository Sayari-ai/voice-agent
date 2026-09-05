// Converts mic float32 samples [-1,1] to int16 PCM and posts ~100 ms chunks (1600 samples @16 kHz).
class PCMWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Int16Array(1600);
    this._n = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        const s = Math.max(-1, Math.min(1, ch[i]));
        this._buf[this._n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this._n === this._buf.length) {
          const out = this._buf.slice(0);
          this.port.postMessage(out.buffer, [out.buffer]);
          this._n = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("pcm-worklet", PCMWorklet);
