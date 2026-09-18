import { GEMINI_MODEL, geminiOnline } from "@/lib/apex/gemini";
import type { Capabilities } from "@/lib/apex/types";
import { elevenLabsOnline } from "@/lib/apex/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gemini = geminiOnline();
  const eleven = elevenLabsOnline();

  const payload: Capabilities = {
    reasoning: gemini
      ? { core: "gemini", label: GEMINI_MODEL, online: true }
      : { core: "local", label: "APEX local core", online: false },
    voice: eleven
      ? { core: "elevenlabs", label: "ElevenLabs turbo", online: true }
      : { core: "browser", label: "On-device synthesis", online: false },
    model: gemini ? GEMINI_MODEL : undefined,
  };

  return Response.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
