import { buildDashboard } from "@/lib/apex/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await buildDashboard();
  return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
}
