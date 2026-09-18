"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HudPanel({
  title,
  meta,
  children,
  className,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "hud-panel relative flex min-h-0 flex-col bg-cyan-950/20 backdrop-blur-[2px]",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-cyan-400/15 px-3 py-2">
        <h2 className="font-[family-name:var(--font-display)] text-[11px] tracking-[0.38em] text-cyan-200">
          {title}
        </h2>
        {meta ? (
          <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-widest text-cyan-400/70">
            {meta}
          </span>
        ) : null}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
