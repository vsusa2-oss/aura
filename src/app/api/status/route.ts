import { NextResponse } from "next/server";
import { engineKind } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    engine: engineKind(),
    voice: process.env.ELEVENLABS_API_KEY ? "elevenlabs" : "browser",
  });
}
