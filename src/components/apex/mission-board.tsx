"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { Mission } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<Mission["status"], string> = {
  queued: "text-cyan-200 border-cyan-400/30",
  running: "text-emerald-200 border-emerald-400/40",
  compiling: "text-amber-200 border-amber-400/40",
  complete: "text-fuchsia-200 border-fuchsia-400/40",
  cancelled: "text-slate-400 border-slate-500/30",
};

export function MissionBoard({ missions }: { missions: Mission[] }) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-3">
        {missions.length === 0 ? (
          <div className="border border-dashed border-cyan-400/20 px-3 py-8 text-center">
            <p className="font-[family-name:var(--font-mono)] text-xs tracking-widest text-cyan-300/60">
              NO ACTIVE MISSIONS
            </p>
            <p className="mt-2 font-[family-name:var(--font-ui)] text-sm text-cyan-100/50">
              Assign research, drafts, reviews, or monitoring. Apex will run it and report back.
            </p>
          </div>
        ) : null}

        {missions.map((mission) => (
          <article
            key={mission.id}
            className="border border-cyan-400/20 bg-black/25 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-[family-name:var(--font-ui)] text-sm font-semibold leading-snug text-cyan-50">
                {mission.title}
              </h3>
              <Badge className={cn("shrink-0", STATUS_TONE[mission.status])}>
                {mission.status}
              </Badge>
            </div>
            <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-cyan-100/55">
              {mission.brief}
            </p>

            <div className="mt-3 h-1 w-full bg-cyan-950">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  mission.status === "complete"
                    ? "bg-fuchsia-400"
                    : mission.status === "cancelled"
                      ? "bg-slate-500"
                      : "bg-cyan-300 shadow-[0_0_10px_rgba(0,229,255,0.8)]",
                )}
                style={{ width: `${mission.progress}%` }}
              />
            </div>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] tracking-widest text-cyan-300/60">
              {Math.round(mission.progress)}%  //  {mission.id}
            </p>

            <ul className="mt-3 space-y-1">
              {mission.logs.slice(-4).map((log, i) => (
                <li
                  key={`${log.at}-${i}`}
                  className="font-[family-name:var(--font-mono)] text-[11px] text-cyan-200/70"
                >
                  <span className="text-cyan-500/70">{log.at}</span>  {log.line}
                </li>
              ))}
            </ul>

            {mission.report ? (
              <p className="mt-3 border-t border-cyan-400/15 pt-3 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-cyan-50/85">
                {mission.report}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </ScrollArea>
  );
}
