"use client";

import { useEffect, useRef } from "react";
import { audioBus } from "@/lib/apex/audio-bus";
import { useLatest } from "@/hooks/use-latest";
import type { DeckStatus } from "@/hooks/use-apex";

const BARS = 56;

/** Linear spectrum strip. Mirrors whichever side of the conversation currently has the floor. */
export function Waveform({ status }: { status: DeckStatus }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useLatest(status);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let t = 0;
    const smooth = new Float32Array(BARS);

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
      t += 0.05;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const mid = h / 2;

      const current = statusRef.current;
      const bus = audioBus();
      const source = current === "speaking" ? bus.readOutput() : bus.readInput();
      const active = current === "listening" || current === "speaking";
      const color = current === "thinking" ? "255, 198, 112" : "110, 231, 255";

      ctx.clearRect(0, 0, w, h);
      const gap = 2;
      const barW = Math.max(1.5, w / BARS - gap);

      for (let i = 0; i < BARS; i++) {
        const raw = source.bins.length
          ? source.bins[Math.floor((i / BARS) * source.bins.length)] / 255
          : 0;
        const idle = active
          ? 0.05
          : (Math.sin(t * 0.9 + i * 0.35) * 0.5 + 0.5) * 0.09 + 0.03;
        const next = Math.max(raw * (active ? 1 : 0), idle);
        smooth[i] += (next - smooth[i]) * 0.25;

        const barH = Math.max(2, smooth[i] * h * 0.92);
        const x = i * (barW + gap);
        ctx.fillStyle = `rgba(${color}, ${0.2 + smooth[i] * 0.75})`;
        ctx.fillRect(x, mid - barH / 2, barW, barH);
      }

      ctx.strokeStyle = `rgba(${color}, 0.14)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [statusRef]);

  return <canvas ref={canvasRef} className="h-10 w-full" aria-hidden />;
}
