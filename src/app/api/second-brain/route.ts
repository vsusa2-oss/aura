import { searchSecondBrain, secondBrainOnline } from "@/lib/apex/second-brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();

  if (!secondBrainOnline()) {
    return Response.json(
      { configured: false, results: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!query) {
    return Response.json(
      { configured: true, results: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const results = await searchSecondBrain(query);
    return Response.json(
      { configured: true, results },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { configured: true, results: [], error: "search failed" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
