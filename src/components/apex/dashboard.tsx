"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ListChecks, Mail, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardPayload } from "@/lib/apex/types";

type LoadState = "loading" | "ready" | "error";

export function Dashboard() {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const fetchDashboard = useCallback(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data: DashboardPayload) => {
        setPayload(data);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const refresh = useCallback(() => {
    setState("loading");
    fetchDashboard();
  }, [fetchDashboard]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between px-4 py-2">
        <span className="hud-label">
          {payload?.configured ? "Life Dashboard" : "Life Dashboard · offline"}
        </span>
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh dashboard"
          className="text-muted-foreground hover:text-primary"
        >
          <RefreshCw className={cn("size-3.5", state === "loading" && "animate-spin")} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {state === "loading" && !payload && (
          <p className="font-mono text-xs text-muted-foreground">Reaching the gateway…</p>
        )}

        {state === "error" && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Couldn&apos;t reach the dashboard endpoint.
          </p>
        )}

        {payload && !payload.configured && (
          <div>
            <p className="hud-label mb-2">Not wired up yet</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Set <code className="font-mono text-foreground/80">HERMES_GATEWAY_URL</code> to
              bring the calendar, inbox, and daily briefing onto the deck.
            </p>
          </div>
        )}

        {payload?.configured && (
          <div className="space-y-4">
            {payload.briefing && (
              <p className="text-sm leading-relaxed text-foreground/90">{payload.briefing}</p>
            )}

            <Section
              icon={<CalendarClock className="size-3.5" />}
              label="Calendar"
              empty="Nothing on the calendar."
              items={payload.calendar?.map((e) => ({
                id: e.id,
                primary: e.title,
                secondary: formatWhen(e.start, e.end),
              }))}
            />

            <Section
              icon={<Mail className="size-3.5" />}
              label="Inbox"
              empty="Inbox is clear."
              items={payload.email?.map((m) => ({
                id: m.id,
                primary: m.subject,
                secondary: `${m.from} — ${m.snippet}`,
              }))}
            />

            <Section
              icon={<ListChecks className="size-3.5" />}
              label="Tasks"
              empty="No open tasks."
              items={payload.tasks?.map((t) => ({
                id: t.id,
                primary: t.title,
                secondary: t.due,
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  icon,
  label,
  items,
  empty,
}: {
  icon: React.ReactNode;
  label: string;
  items?: Array<{ id: string; primary: string; secondary?: string }>;
  empty: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-primary/70">
        {icon}
        <span className="hud-label">{label}</span>
      </div>
      {!items || !items.length ? (
        <p className="pl-5 text-xs text-muted-foreground/70">{empty}</p>
      ) : (
        <ul className="space-y-1.5 pl-5">
          {items.map((item) => (
            <li key={item.id} className="text-xs leading-relaxed">
              <span className="text-foreground/90">{item.primary}</span>
              {item.secondary && (
                <span className="block text-[11px] text-muted-foreground/70">
                  {item.secondary}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatWhen(start: string, end?: string): string {
  try {
    const s = new Date(start);
    const startLabel = s.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (!end) return startLabel;
    const e = new Date(end);
    const endLabel = e.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `${startLabel} – ${endLabel}`;
  } catch {
    return start;
  }
}
