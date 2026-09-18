"use client";

import { useEffect, useRef } from "react";
import { audioBus } from "@/lib/apex/audio-bus";
import { useLatest } from "@/hooks/use-latest";
import type { DeckStatus } from "@/hooks/use-apex";

const PALETTE: Record<DeckStatus, { hue: string; glow: string; intensity: number }> = {
  standby: { hue: "184, 210, 228", glow: "120, 190, 220", intensity: 0.42 },
  listening: { hue: "110, 231, 255", glow: "56, 214, 255", intensity: 1 },
  thinking: { hue: "255, 198, 112", glow: "255, 176, 60", intensity: 0.82 },
  speaking: { hue: "150, 245, 255", glow: "90, 226, 255", intensity: 1 },
};

interface Props {
  status: DeckStatus;
  /** Rendered in the middle of the ring stack. */
  caption: string;
}

/**
 * The reactor. Everything it draws is driven by the live audio analysers, so the ring
 * that blooms while the operator talks is literally their voice, not a loop.
 */
export function ReactorCore({ status, caption }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useLatest(status);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    let t = 0;
    let smoothLevel = 0;
    const smoothBins = new Float32Array(64);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = () => {
      frame = requestAnimationFrame(draw);
      t += reduced ? 0.002 : 0.012;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2;

      const current = statusRef.current;
      const skin = PALETTE[current];
      const bus = audioBus();
      const source = current === "speaking" ? bus.readOutput() : bus.readInput();

      const target =
        current === "thinking"
          ? 0.28 + Math.abs(Math.sin(t * 2.1)) * 0.22
          : Math.min(1, source.level * 2.4);
      smoothLevel += (target - smoothLevel) * 0.18;

      for (let i = 0; i < smoothBins.length; i++) {
        const raw = source.bins.length
          ? source.bins[Math.floor((i / smoothBins.length) * source.bins.length)] / 255
          : 0;
        const idle =
          current === "thinking"
            ? (Math.sin(t * 2.6 + i * 0.4) * 0.5 + 0.5) * 0.35
            : (Math.sin(t * 1.1 + i * 0.28) * 0.5 + 0.5) * 0.08;
        const next = Math.max(raw, idle);
        smoothBins[i] += (next - smoothBins[i]) * 0.22;
      }

      ctx.clearRect(0, 0, w, h);

      const bloom = 0.35 + smoothLevel * 0.65;

      // Core glow
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.92);
      glow.addColorStop(0, `rgba(${skin.glow}, ${0.34 * bloom * skin.intensity})`);
      glow.addColorStop(0.45, `rgba(${skin.glow}, ${0.1 * bloom})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Static reference rings
      ring(ctx, cx, cy, radius * 0.94, `rgba(${skin.hue}, 0.12)`, 1);
      ring(ctx, cx, cy, radius * 0.62, `rgba(${skin.hue}, 0.16)`, 1);
      ring(ctx, cx, cy, radius * 0.3, `rgba(${skin.hue}, 0.2)`, 1);

      // Tick collar
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * 0.18);
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        const major = i % 8 === 0;
        const inner = radius * (major ? 0.8 : 0.84);
        const outer = radius * 0.875;
        ctx.strokeStyle = `rgba(${skin.hue}, ${major ? 0.5 : 0.2})`;
        ctx.lineWidth = major ? 1.6 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
        ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
        ctx.stroke();
      }
      ctx.restore();

      // Counter-rotating arc segments
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.42);
      arc(ctx, radius * 0.72, -0.3, 1.25, `rgba(${skin.hue}, 0.75)`, 2.2);
      arc(ctx, radius * 0.72, 2.3, 3.1, `rgba(${skin.hue}, 0.35)`, 2.2);
      ctx.restore();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * 0.26);
      arc(ctx, radius * 0.55, 1.1, 2.6, `rgba(${skin.hue}, 0.5)`, 1.4);
      arc(ctx, radius * 0.55, 4.0, 5.2, `rgba(${skin.hue}, 0.28)`, 1.4);
      ctx.restore();

      // Radial spectrum — the voice itself
      ctx.save();
      ctx.translate(cx, cy);
      const bars = smoothBins.length;
      for (let i = 0; i < bars; i++) {
        const a = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const amp = smoothBins[i];
        const base = radius * 0.34;
        const len = radius * 0.24 * amp * (0.6 + skin.intensity * 0.6);
        const alpha = 0.25 + amp * 0.7;
        ctx.strokeStyle = `rgba(${skin.hue}, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * base, Math.sin(a) * base);
        ctx.lineTo(Math.cos(a) * (base + len), Math.sin(a) * (base + len));
        ctx.stroke();
      }
      ctx.restore();

      // Breathing core
      const coreR = radius * (0.17 + smoothLevel * 0.055);
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      core.addColorStop(0, `rgba(255,255,255,${0.7 * bloom})`);
      core.addColorStop(0.35, `rgba(${skin.glow}, ${0.55 * bloom})`);
      core.addColorStop(1, `rgba(${skin.glow}, 0)`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      ring(ctx, cx, cy, coreR * 1.5, `rgba(${skin.hue}, ${0.35 + smoothLevel * 0.4})`, 1.2);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [statusRef]);

  return (
    <div className="relative aspect-square w-full max-w-[min(62vh,30rem)]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
        <span className="hud-label text-primary/70">{statusCopy[status].kicker}</span>
        <span className="hud-text-glow font-mono text-sm font-medium tracking-[0.18em] text-primary uppercase sm:text-base">
          {statusCopy[status].title}
        </span>
        <span className="mt-1 max-w-[62%] text-center text-xs text-muted-foreground/80">
          {caption}
        </span>
      </div>
    </div>
  );
}

const statusCopy: Record<DeckStatus, { kicker: string; title: string }> = {
  standby: { kicker: "Core", title: "Standby" },
  listening: { kicker: "Uplink", title: "Listening" },
  thinking: { kicker: "Core", title: "Reasoning" },
  speaking: { kicker: "Output", title: "Speaking" },
};

function ring(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  width: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function arc(
  ctx: CanvasRenderingContext2D,
  r: number,
  from: number,
  to: number,
  color: string,
  width: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, r, from, to);
  ctx.stroke();
}
