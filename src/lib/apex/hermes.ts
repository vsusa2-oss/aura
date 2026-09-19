// Bridge to a self-hosted Hermes Agent (https://github.com/NousResearch/hermes-agent),
// which holds the Calendar/Gmail/Obsidian-vault integrations and the cron scheduler.
// See docs/agent-system/PLAN.md for why those live there instead of in this repo.

const HERMES_TIMEOUT_MS = 15_000;

export function hermesGatewayUrl(): string | undefined {
  const url = process.env.HERMES_GATEWAY_URL;
  return url && url.trim() ? url.trim().replace(/\/$/, "") : undefined;
}

export function hermesKey(): string | undefined {
  const key = process.env.HERMES_API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

export function hermesOnline(): boolean {
  return Boolean(hermesGatewayUrl());
}

async function callHermes<T>(path: string, body: unknown): Promise<T> {
  const base = hermesGatewayUrl();
  if (!base) throw new Error("Hermes gateway not configured");

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(hermesKey() ? { authorization: `Bearer ${hermesKey()}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(HERMES_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Hermes gateway ${path} returned ${res.status}`);
  return (await res.json()) as T;
}

export async function hermesDashboard(): Promise<{
  briefing?: string;
  calendar?: Array<{ id: string; title: string; start: string; end?: string }>;
  email?: Array<{ id: string; from: string; subject: string; snippet: string }>;
  tasks?: Array<{ id: string; title: string; due?: string }>;
}> {
  return callHermes("/v1/dashboard", {});
}

export async function hermesSearchMemory(
  query: string,
  source: string,
): Promise<Array<{ path: string; title: string; excerpt: string; score: number }>> {
  const data = await callHermes<{ results: Array<{ path: string; title: string; excerpt: string; score: number }> }>(
    "/v1/memory/search",
    { query, source },
  );
  return data.results ?? [];
}

export async function hermesCheckIn(mode: "morning" | "nightly" | "weekly"): Promise<string> {
  const data = await callHermes<{ summary: string }>("/v1/checkin", { mode });
  return data.summary;
}
