"use client";

import { useEffect, useRef, useState } from "react";
import { audioBus } from "@/lib/apex/audio-bus";
import { cn } from "@/lib/utils";
import type { Capabilities } from "@/lib/apex/types";

interface Props {
  capabilities: Capabilities | null;
  bootedAt: number;
  exchanges: number;
  running: number;
  completed: number;
  micOpen: boolean;
}

export function Telemetry({
  capabilities,
  bootedAt,
  exchanges,
  running,
  completed,
  micOpen,
}: Props) {
  const uptime = useUptime(bootedAt);
  const level = useInputLevel(micOpen);

  const reasoning = capabilities?.reasoning;
  const voice = capabilities?.voice;

  return (
    <div className="space-y-3 px-4 py-4">
      <Row
        label="Reasoning core"
        value={reasoning?.label ?? "…"}
        tone={reasoning?.online ? "good" : "warn"}
        note={reasoning?.online ? "remote" : "local fallback"}
      />
      <Row
        label="Voice path"
        value={voice?.label ?? "…"}
        tone={voice?.online ? "good" : "warn"}
        note={voice?.online ? "streamed" : "on-device"}
      />
      <Row label="Uptime" value={uptime} tone="neutral" mono />
      <Row label="Exchanges" value={String(exchanges).padStart(2, "0")} tone="neutral" mono />
      <Row
        label="Assignments"
        value={`${String(running).padStart(2, "0")} live / ${String(completed).padStart(2, "0")} closed`}
        tone={running ? "good" : "neutral"}
        mono
      />

      <div className="pt-1">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="hud-label">Input gain</span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {micOpen ? `${String(Math.round(level * 100)).padStart(3, "0")}%` : "closed"}
          </span>
        </div>
        <div className="flex h-2 gap-0.5">
          {Array.from({ length: 24 }).map((_, i) => {
            const lit = micOpen && level * 24 > i;
            return (
              <span
                key={i}
                className={cn(
                  "flex-1 rounded-[1px] transition-colors duration-75",
                  lit
                    ? i > 19
                      ? "bg-destructive"
                      : i > 15
                        ? "bg-[color:var(--alert)]"
                        : "bg-primary"
                    : "bg-secondary",
                )}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  note,
  tone,
  mono,
}: {
  label: string;
  value: string;
  note?: string;
  tone: "good" | "warn" | "neutral";
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="hud-label shrink-0">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        {tone !== "neutral" && (
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              tone === "good"
                ? "bg-[color:var(--chart-4)] shadow-[0_0_8px_currentColor]"
                : "bg-[color:var(--alert)] shadow-[0_0_8px_currentColor]",
            )}
          />
        )}
        <span
          className={cn(
            "truncate text-right text-[13px] text-foreground/90",
            mono && "font-mono tabular-nums",
          )}
          title={note ? `${value} (${note})` : value}
        >
          {value}
        </span>
      </span>
    </div>
  );
}

function useUptime(bootedAt: number) {
  const [now, setNow] = useState(bootedAt);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - bootedAt) / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function useInputLevel(active: boolean) {
  const [level, setLevel] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!active) return;
    let smooth = 0;
    const tick = () => {
      raf.current = requestAnimationFrame(tick);
      const next = Math.min(1, audioBus().readInput().level * 2.6);
      smooth += (next - smooth) * 0.25;
      setLevel(smooth);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [active]);

  return active ? level : 0;
}
