"use client";

import type { Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2, OctagonAlert } from "lucide-react";

const statusIcon: Record<TaskStatus, typeof Circle> = {
  pending: Circle,
  in_progress: Loader2,
  completed: CheckCircle2,
  blocked: OctagonAlert,
};

const statusLabel: Record<TaskStatus, string> = {
  pending: "Queued",
  in_progress: "Active",
  completed: "Done",
  blocked: "Blocked",
};

export function TaskPanel({ tasks }: { tasks: Task[] }) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-lg border border-cyan-500/20 bg-black/40 backdrop-blur-sm">
      <header className="border-b border-cyan-500/15 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-400/80">
          Mission log
        </p>
        <h2 className="text-sm font-medium text-cyan-50">Assigned operations</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-3">
        {tasks.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-cyan-100/40">
            No missions logged. Assign work in conversation — APEX will track and
            report status here.
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => {
              const Icon = statusIcon[task.status];
              return (
                <li
                  key={task.id}
                  className="rounded border border-cyan-500/10 bg-cyan-950/20 px-3 py-2.5"
                >
                  <div className="flex items-start gap-2">
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 text-cyan-400",
                        task.status === "in_progress" && "animate-spin",
                        task.status === "completed" && "text-emerald-400",
                        task.status === "blocked" && "text-amber-400",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-cyan-50">{task.title}</p>
                      {task.detail ? (
                        <p className="mt-0.5 text-xs text-cyan-100/50">
                          {task.detail}
                        </p>
                      ) : null}
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-cyan-400/60">
                        {statusLabel[task.status]} · {task.id}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
