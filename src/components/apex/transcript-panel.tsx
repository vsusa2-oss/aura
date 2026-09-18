"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { TranscriptEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

function stamp(at: number) {
  return new Date(at).toISOString().slice(11, 19);
}

export function TranscriptPanel({
  entries,
  interim,
}: {
  entries: TranscriptEntry[];
  interim?: string;
}) {
  return (
    <ScrollArea className="h-full">
      <ol className="space-y-3 p-3">
        {entries.length === 0 && !interim ? (
          <li className="border border-dashed border-cyan-400/20 px-3 py-6 text-center">
            <p className="font-[family-name:var(--font-mono)] text-xs tracking-widest text-cyan-300/60">
              CHANNEL OPEN — AWAITING OPERATOR
            </p>
          </li>
        ) : null}
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={cn(
              "border-l-2 px-3 py-2",
              entry.role === "operator" && "border-amber-300/70 bg-amber-300/5",
              entry.role === "apex" && "border-cyan-300/80 bg-cyan-400/5",
              entry.role === "system" && "border-fuchsia-300/70 bg-fuchsia-400/5",
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-[family-name:var(--font-display)] text-[10px] tracking-[0.28em] text-cyan-200/80">
                {entry.role === "operator"
                  ? "OPERATOR"
                  : entry.role === "apex"
                    ? "APEX"
                    : "SYS"}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-cyan-400/50">
                {stamp(entry.at)}
              </span>
            </div>
            <p className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-cyan-50/90">
              {entry.text}
            </p>
          </li>
        ))}
        {interim ? (
          <li className="border-l-2 border-emerald-300/80 bg-emerald-300/5 px-3 py-2">
            <div className="mb-1 font-[family-name:var(--font-display)] text-[10px] tracking-[0.28em] text-emerald-200">
              LIVE
            </div>
            <p className="font-[family-name:var(--font-ui)] text-sm text-emerald-100/90">
              {interim}
            </p>
          </li>
        ) : null}
      </ol>
    </ScrollArea>
  );
}
