"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { EngineKind, LinkState } from "@/lib/types";

export function StatusRail({
  state,
  engine,
  voice,
  clock,
}: {
  state: LinkState;
  engine: EngineKind;
  voice: "elevenlabs" | "browser";
  clock: string;
}) {
  const [pulse, setPulse] = useState(64);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPulse(48 + Math.round(Math.random() * 40));
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-400/20 px-1 pb-3">
      <div className="flex items-end gap-4">
        <div>
          <p className="font-[family-name:var(--font-display)] text-3xl tracking-[0.35em] text-cyan-100 sm:text-4xl">
            APEX
          </p>
          <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.32em] text-cyan-400/70">
            AUTONOMOUS PROTOCOL // EXECUTIVE EXCHANGE
          </p>
        </div>
        <Badge>CORE 2017.9</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.22em] text-cyan-300/80">
        <span className="border border-cyan-400/20 px-2 py-1">UPLINK {pulse}%</span>
        <span className="border border-cyan-400/20 px-2 py-1">
          ENGINE {engine.toUpperCase()}
        </span>
        <span className="border border-cyan-400/20 px-2 py-1">
          VOICE {voice === "elevenlabs" ? "ELEVEN" : "LOCAL"}
        </span>
        <span className="border border-cyan-400/20 px-2 py-1">{state.toUpperCase()}</span>
        <span className="border border-cyan-400/20 px-2 py-1">{clock}Z</span>
      </div>
    </header>
  );
}
