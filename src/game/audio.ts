// Kleine Web-Audio-Synth-Engine: Sirene + Einschläge. Nur im Browser nach Nutzerinteraktion.
class AudioEngine {
  private ctx: AudioContext | null = null;
  private siren: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null = null;
  muted = false;

  init() {
    if (typeof window === "undefined") return;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.setSiren(false);
    return this.muted;
  }

  setSiren(on: boolean) {
    if (!this.ctx) return;
    on = on && !this.muted;
    if (on && !this.siren) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 520;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.18;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain).connect(osc.frequency);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1400;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 1.2);
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start();
      lfo.start();
      this.siren = { osc, gain, lfo };
    } else if (!on && this.siren) {
      const { osc, gain, lfo } = this.siren;
      const t = this.ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.6);
      osc.stop(t + 0.7);
      lfo.stop(t + 0.7);
      this.siren = null;
    }
  }

  boom(nuclear: boolean, intercepted: boolean) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const dur = nuclear ? 2.4 : intercepted ? 0.5 : 0.9;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = intercepted ? 2400 : nuclear ? 260 : 700;
    const gain = ctx.createGain();
    gain.gain.value = nuclear ? 0.5 : 0.22;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  }

  click() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.04, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.1);
  }
}

export const audio = new AudioEngine();
