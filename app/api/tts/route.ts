export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { text?: string; voiceId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return Response.json({ error: "Missing text" }, { status: 400 });
  }

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const voiceId =
    body.voiceId ||
    process.env.ELEVENLABS_VOICE_ID ||
    "21m00Tcm4TlvDq8ikWAM";

  if (!elevenKey) {
    return Response.json({
      provider: "browser",
      message: "Use Web Speech synthesis on the client",
    });
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key": elevenKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL ?? "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    return Response.json(
      { error: "ElevenLabs failed", detail: err.slice(0, 200) },
      { status: 502 },
    );
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
