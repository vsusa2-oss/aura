import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_ID || "onwK4e9ZLuTAKqWW03F9";

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const { text } = (await req.json()) as { text?: string };
    const spoken = (text || "").slice(0, 1800).trim();
    if (!spoken) {
      return NextResponse.json({ error: "No text" }, { status: 400 });
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: spoken,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.42,
            similarity_boost: 0.75,
            style: 0.15,
          },
        }),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("ElevenLabs error", res.status, detail.slice(0, 300));
      return new NextResponse(null, { status: 204 });
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);
    return new NextResponse(null, { status: 204 });
  }
}
