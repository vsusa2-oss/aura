"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

type Line = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

export function TranscriptPanel({ lines }: { lines: Line[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-lg border border-cyan-500/20 bg-black/40 backdrop-blur-sm">
      <header className="border-b border-cyan-500/15 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-400/80">
          Comms channel
        </p>
        <h2 className="text-sm font-medium text-cyan-50">Live transcript</h2>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {lines.map((line) => (
          <div
            key={line.id}
            className={cn(
              "max-w-[95%] rounded-md border px-3 py-2 text-sm leading-relaxed",
              line.role === "user"
                ? "ml-auto border-teal-500/25 bg-teal-950/30 text-teal-50"
                : "mr-auto border-cyan-500/20 bg-cyan-950/25 text-cyan-50",
            )}
          >
            <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.25em] text-white/35">
              {line.role === "user" ? "Operator" : "APEX"}
            </span>
            {line.content || (line.streaming ? "…" : "")}
            {line.streaming ? (
              <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-cyan-400" />
            ) : null}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}
