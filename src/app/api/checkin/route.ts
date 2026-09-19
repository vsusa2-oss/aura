import { runCheckIn } from "@/lib/apex/executive-assistant";
import type { CheckInMode } from "@/lib/apex/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES: readonly CheckInMode[] = ["morning", "nightly", "weekly"];

function isMode(value: unknown): value is CheckInMode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

// Manual trigger from the deck.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const mode = isMode(body?.mode) ? body.mode : "morning";
  const result = await runCheckIn(mode);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}

// Cron hits this with no body — mode comes from the query string, see vercel.json.
export async function GET(request: Request) {
  const modeParam = new URL(request.url).searchParams.get("mode");
  const mode = isMode(modeParam) ? modeParam : "morning";
  const result = await runCheckIn(mode);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
