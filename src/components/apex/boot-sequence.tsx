"use client";

import { useEffect, useState } from "react";
import { Mic, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Capabilities } from "@/lib/apex/types";

const LINES = [
  "apexd — deck supervisor  [ok]",
  "mounting audio bus ......  [ok]",
  "spectrum analysers x2 ...  [ok]",
  "assignment scheduler ....  [ok]",
  "transcript ring buffer ..  [ok]",
];

interface Props {
  capabilities: Capabilities | null;
  onEngage: (handsFree: boolean) => void;
}

export function BootSequence({ capabilities, onEngage }: Props) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown >= LINES.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 220 + shown * 40);
    return () => clearTimeout(t);
  }, [shown]);

  const ready = shown >= LINES.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 px-6 backdrop-blur-sm">
      <div className="hud-scanlines relative w-full max-w-lg">
        <div className="mb-8 text-center">
          <p className="hud-label mb-2">Operations deck</p>
          <h1 className="hud-text-glow text-6xl leading-none font-bold tracking-[0.32em] text-primary sm:text-7xl">
            APEX
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Voice-first intelligence. Talk to it, hand it work, get debriefed.
          </p>
        </div>

        <div className="hud-notch hud-panel space-y-1 p-4 font-mono text-[11px] text-muted-foreground">
          {LINES.slice(0, shown).map((line) => (
            <p key={line} className="animate-hud-rise">
              <span className="text-primary/60">&gt;</span> {line}
            </p>
          ))}
          {ready && (
            <p className="animate-hud-rise pt-1 text-primary">
              <span className="text-primary/60">&gt;</span> reasoning:{" "}
              {capabilities?.reasoning.label ?? "resolving…"} · voice:{" "}
              {capabilities?.voice.label ?? "resolving…"}
            </p>
          )}
          {!ready && <span className="animate-hud-caret inline-block text-primary">▌</span>}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            className="hud-notch flex-1 font-mono tracking-[0.2em] uppercase"
            disabled={!ready}
            onClick={() => onEngage(true)}
          >
            <Mic className="size-4" />
            Engage · hands free
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="hud-notch font-mono tracking-[0.2em] uppercase"
            disabled={!ready}
            onClick={() => onEngage(false)}
          >
            <Power className="size-4" />
            Text only
          </Button>
        </div>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground/70">
          Hands-free asks for your microphone and keeps the channel open. You can switch
          modes at any time from the deck header.
        </p>
      </div>
    </div>
  );
}
