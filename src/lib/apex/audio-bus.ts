"use client";

/**
 * One AudioContext shared by the whole deck.
 *
 * Two analysers hang off it: the microphone (what the operator is saying) and APEX's own
 * output (what it is saying back). Browser speech synthesis gives us no audio node to tap,
 * so in that mode the output spectrum is synthesised from a drifting envelope instead —
 * the visualiser stays honest about *when* APEX is talking even when it cannot measure it.
 */

const BINS = 64;

class AudioBus {
  private ctx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private outAnalyser: AnalyserNode | null = null;
  private outSource: MediaElementAudioSourceNode | null = null;
  private outEl: HTMLAudioElement | null = null;
  private micBuf = new Uint8Array(BINS * 2);
  private outBuf = new Uint8Array(BINS * 2);
  private synthetic = false;
  private phase = 0;

  context(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  async resume(): Promise<void> {
    const ctx = this.context();
    if (ctx && ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* the deck still works without metering */
      }
    }
  }

  async startMic(): Promise<boolean> {
    if (this.micAnalyser) return true;
    const ctx = this.context();
    if (!ctx || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = BINS * 4;
      analyser.smoothingTimeConstant = 0.72;
      src.connect(analyser);
      this.micStream = stream;
      this.micAnalyser = analyser;
      this.micBuf = new Uint8Array(analyser.frequencyBinCount);
      return true;
    } catch {
      return false;
    }
  }

  stopMic(): void {
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    this.micAnalyser = null;
  }

  /** Route an <audio> element through the output analyser exactly once. */
  attachOutput(el: HTMLAudioElement): void {
    const ctx = this.context();
    if (!ctx || this.outEl === el) return;
    try {
      const src = ctx.createMediaElementSource(el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = BINS * 4;
      analyser.smoothingTimeConstant = 0.7;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      this.outEl = el;
      this.outSource = src;
      this.outAnalyser = analyser;
      this.outBuf = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      /* already attached in a previous mount */
    }
  }

  /** Browser synthesis has no tappable node; drive the visualiser from a fake envelope. */
  setSynthetic(on: boolean): void {
    this.synthetic = on;
  }

  readInput(): { level: number; bins: Uint8Array } {
    if (!this.micAnalyser) return { level: 0, bins: EMPTY };
    this.micAnalyser.getByteFrequencyData(this.micBuf as Uint8Array<ArrayBuffer>);
    return { level: rms(this.micBuf), bins: this.micBuf };
  }

  readOutput(): { level: number; bins: Uint8Array } {
    if (this.synthetic) {
      this.phase += 0.09;
      const bins = new Uint8Array(BINS);
      for (let i = 0; i < BINS; i++) {
        const fall = Math.exp(-i / 22);
        const wobble =
          Math.sin(this.phase * 1.7 + i * 0.31) * 0.5 +
          Math.sin(this.phase * 0.9 - i * 0.17) * 0.35 +
          Math.sin(this.phase * 3.1 + i * 0.07) * 0.15;
        bins[i] = Math.max(0, Math.min(255, (0.55 + wobble * 0.45) * 235 * fall));
      }
      return { level: 0.42 + Math.sin(this.phase * 1.3) * 0.12, bins };
    }
    if (!this.outAnalyser) return { level: 0, bins: EMPTY };
    this.outAnalyser.getByteFrequencyData(this.outBuf as Uint8Array<ArrayBuffer>);
    return { level: rms(this.outBuf), bins: this.outBuf };
  }

  dispose(): void {
    this.stopMic();
    this.outSource?.disconnect();
    this.outAnalyser?.disconnect();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.outEl = null;
  }
}

const EMPTY = new Uint8Array(BINS);

function rms(buf: Uint8Array): number {
  let sum = 0;
  const n = Math.min(buf.length, 48);
  for (let i = 0; i < n; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / n) / 255;
}

let bus: AudioBus | null = null;

export function audioBus(): AudioBus {
  if (!bus) bus = new AudioBus();
  return bus;
}

export type { AudioBus };
