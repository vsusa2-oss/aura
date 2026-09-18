"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Mission, MissionAction } from "@/lib/types";
import { nowStamp, uid } from "@/lib/utils";

const STAGE_LINES: [number, string][] = [
  [6, "Allocating compute"],
  [18, "Opening source channels"],
  [34, "Cross-checking live context"],
  [52, "Compiling working notes"],
  [74, "Drafting operator brief"],
  [91, "Final integrity pass"],
];

function seedLogs(title: string): Mission["logs"] {
  return [{ at: nowStamp(), line: `Queued — ${title}` }];
}

export function useMissions(onReadyToReport: (mission: Mission) => void) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const reported = useRef(new Set<string>());
  const onReadyRef = useRef(onReadyToReport);

  useEffect(() => {
    onReadyRef.current = onReadyToReport;
  }, [onReadyToReport]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setMissions((prev) => {
        let changed = false;
        const next = prev.map((m) => {
          if (m.status === "complete" || m.status === "cancelled") return m;
          const increment = m.status === "queued" ? 4 : 3 + Math.random() * 4;
          const progress = Math.min(100, m.progress + increment);
          const logs = [...m.logs];
          let status = m.status === "queued" ? ("running" as const) : m.status;

          for (const [pct, line] of STAGE_LINES) {
            if (progress >= pct && !logs.some((l) => l.line === line)) {
              logs.push({ at: nowStamp(), line });
              changed = true;
            }
          }
          if (progress >= 70 && status === "running") {
            status = "compiling";
            changed = true;
          }
          if (progress >= 100) {
            status = "compiling";
          }
          if (progress !== m.progress || status !== m.status) changed = true;
          return { ...m, progress, status, logs, updatedAt: Date.now() };
        });
        return changed ? next : prev;
      });
    }, 700);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    for (const m of missions) {
      if (m.progress >= 100 && m.status !== "cancelled" && !reported.current.has(m.id) && !m.report) {
        reported.current.add(m.id);
        onReadyRef.current(m);
      }
    }
  }, [missions]);

  const applyActions = useCallback((actions: MissionAction[]) => {
    if (!actions?.length) return;
    setMissions((prev) => {
      let next = [...prev];
      for (const action of actions) {
        if (action.action === "create" && action.title) {
          const mission: Mission = {
            id: uid("msn"),
            title: action.title,
            brief: action.brief || action.title,
            status: "queued",
            progress: 0,
            logs: seedLogs(action.title),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          next = [mission, ...next];
        }
        if (action.action === "cancel") {
          next = next.map((m) => {
            const match =
              (action.id && m.id === action.id) ||
              (action.title && m.title.toLowerCase().includes(action.title.toLowerCase()));
            if (!match || m.status === "complete") return m;
            return {
              ...m,
              status: "cancelled" as const,
              logs: [...m.logs, { at: nowStamp(), line: "Cancelled by operator" }],
              updatedAt: Date.now(),
            };
          });
        }
      }
      return next;
    });
  }, []);

  const completeWithReport = useCallback((id: string, report: string) => {
    setMissions((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              status: "complete" as const,
              progress: 100,
              report,
              logs: [...m.logs, { at: nowStamp(), line: "Report filed" }],
              updatedAt: Date.now(),
            }
          : m,
      ),
    );
  }, []);

  return { missions, applyActions, completeWithReport };
}
