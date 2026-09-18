import { NextResponse } from "next/server";
import { runApexTurn } from "@/lib/gemini";
import type { ChatMessage, Mission } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      messages?: ChatMessage[];
      missions?: Pick<Mission, "id" | "title" | "status" | "progress">[];
    };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) {
      return NextResponse.json({ error: "No messages" }, { status: 400 });
    }
    const turn = await runApexTurn(messages, body.missions ?? []);
    return NextResponse.json(turn);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Core link failed" },
      { status: 500 },
    );
  }
}
