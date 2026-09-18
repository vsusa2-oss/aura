"use client";

import { Check, ChevronRight, CircleDot, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/apex/types";

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) {
    return (
      <div className="px-4 py-6">
        <p className="hud-label mb-2">Board clear</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Nothing assigned. Hand APEX a piece of work and it appears here with live phase
          tracking, then reports back into the transcript when it lands.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-y-auto px-3 py-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const done = task.state === "complete";
  const dropped = task.state === "cancelled";
  const live = !done && !dropped;
  const activeStep = task.steps.find((s) => s.state === "active");

  return (
    <article
      className={cn(
        "hud-notch hud-panel animate-hud-rise relative overflow-hidden p-3",
        done && "opacity-80",
        dropped && "opacity-55",
      )}
    >
      {live && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-primary/12 to-transparent" />
      )}

      <header className="flex items-start justify-between gap-2">
        <h3
          className={cn(
            "text-[15px] leading-tight font-semibold tracking-wide text-foreground",
            dropped && "line-through decoration-muted-foreground/50",
          )}
        >
          {task.title}
        </h3>
        <StateChip task={task} />
      </header>

      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {task.brief}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-200 ease-linear",
              dropped
                ? "bg-muted-foreground/40"
                : done
                  ? "bg-[color:var(--chart-4)]"
                  : "bg-primary",
            )}
            style={{ width: `${Math.max(2, task.progress)}%` }}
          />
        </div>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {String(Math.round(task.progress)).padStart(3, "0")}%
        </span>
      </div>

      {!dropped && (
        <ol className="mt-3 space-y-1.5">
          {task.steps.map((step, i) => (
            <li
              key={`${step.label}-${i}`}
              className={cn(
                "flex items-center gap-2 font-mono text-[11px]",
                step.state === "done" && "text-muted-foreground/60",
                step.state === "active" && "text-primary",
                step.state === "pending" && "text-muted-foreground/40",
              )}
            >
              {step.state === "done" ? (
                <Check className="size-3 shrink-0 text-[color:var(--chart-4)]" />
              ) : step.state === "active" ? (
                <Loader2 className="size-3 shrink-0 animate-spin" />
              ) : (
                <CircleDot className="size-3 shrink-0 opacity-40" />
              )}
              <span className="truncate">{step.label}</span>
            </li>
          ))}
        </ol>
      )}

      {activeStep && (
        <p className="mt-2 font-mono text-[10px] tracking-wider text-primary/70 uppercase">
          now · {activeStep.label}
        </p>
      )}

      {task.report && (
        <div className="mt-3 border-l-2 border-[color:var(--chart-4)]/50 pl-3">
          <p className="hud-label mb-1 text-[color:var(--chart-4)]/80">Filed report</p>
          <p className="text-xs leading-relaxed text-foreground/80">{task.report}</p>
        </div>
      )}

      <ActivityLog lines={task.log} />
    </article>
  );
}

/** The last few entries only — the full trail lives in the transcript. */
function ActivityLog({ lines }: { lines: Task["log"] }) {
  if (!lines.length) return null;
  const tail = lines.slice(-4);
  return (
    <details className="group mt-3">
      <summary className="hud-label flex cursor-pointer list-none items-center gap-1 hover:text-primary">
        <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
        Activity · {lines.length}
      </summary>
      <ul className="mt-1.5 space-y-1 border-l border-primary/15 pl-3">
        {tail.map((entry, i) => (
          <li key={`${entry.at}-${i}`} className="flex gap-2 font-mono text-[10px]">
            <span className="shrink-0 tabular-nums text-muted-foreground/45">
              {new Date(entry.at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <span className="truncate text-muted-foreground/75">{entry.line}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function StateChip({ task }: { task: Task }) {
  const map = {
    queued: { label: "Queued", cls: "text-muted-foreground border-muted-foreground/30" },
    running: { label: "Running", cls: "text-primary border-primary/40" },
    complete: { label: "Reported", cls: "text-[color:var(--chart-4)] border-[color:var(--chart-4)]/40" },
    cancelled: { label: "Dropped", cls: "text-muted-foreground/70 border-muted-foreground/25" },
    failed: { label: "Failed", cls: "text-destructive border-destructive/40" },
  } as const;
  const chip = map[task.state];

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {task.priority === "critical" && task.state !== "cancelled" && (
        <span className="animate-hud-flicker rounded-xs border border-[color:var(--alert)]/50 px-1.5 py-px font-mono text-[9px] tracking-widest text-[color:var(--alert)] uppercase">
          Prio
        </span>
      )}
      <span
        className={cn(
          "rounded-xs border px-1.5 py-px font-mono text-[9px] tracking-widest uppercase",
          chip.cls,
        )}
      >
        {chip.label}
      </span>
    </div>
  );
}
