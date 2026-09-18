import { NextResponse } from "next/server";
import { runMissionReport } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      title?: string;
      brief?: string;
      context?: string;
    };
    const title = (body.title || "Assignment").slice(0, 200);
    const brief = (body.brief || "").slice(0, 500);
    const context = (body.context || "").slice(0, 2000);
    const result = await runMissionReport(title, brief, context);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Report failed" }, { status: 500 });
  }
}
