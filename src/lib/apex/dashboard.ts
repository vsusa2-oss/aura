import { hermesDashboard, hermesOnline } from "./hermes";
import type { DashboardPayload } from "./types";

export async function buildDashboard(): Promise<DashboardPayload> {
  const generatedAt = Date.now();
  if (!hermesOnline()) return { configured: false, generatedAt };

  try {
    const data = await hermesDashboard();
    return { configured: true, generatedAt, ...data };
  } catch {
    return { configured: false, generatedAt };
  }
}
