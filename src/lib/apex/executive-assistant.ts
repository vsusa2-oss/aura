import { hermesCheckIn, hermesOnline } from "./hermes";
import type { CheckInMode, CheckInResult } from "./types";

export async function runCheckIn(mode: CheckInMode): Promise<CheckInResult> {
  const generatedAt = Date.now();
  if (!hermesOnline()) return { mode, summary: fallbackSummary(mode), generatedAt };

  try {
    const summary = await hermesCheckIn(mode);
    return { mode, summary, generatedAt };
  } catch {
    return { mode, summary: fallbackSummary(mode), generatedAt };
  }
}

function fallbackSummary(mode: CheckInMode): string {
  switch (mode) {
    case "morning":
      return "No morning briefing yet — set HERMES_GATEWAY_URL to bring the Life Dashboard online.";
    case "nightly":
      return "No nightly review yet — set HERMES_GATEWAY_URL to bring the Executive Assistant online.";
    case "weekly":
      return "No weekly rollup yet — set HERMES_GATEWAY_URL to bring the Executive Assistant online.";
  }
}
