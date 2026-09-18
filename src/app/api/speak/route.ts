import {
  DEFAULT_TTS_MODEL,
  DEFAULT_VOICE_ID,
  elevenLabsKey,
} from "@/lib/apex/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiKey = elevenLabsKey();
  // 204 tells the client to fall back to the browser's own speech synthesis.
  if (!apiKey) return new Response(null, { status: 204 });

  let text: string | undefined;
  try {
    const body = (await request.json()) as { text?: string };
    text = body.text;
  } catch {
    return Response.json({ error: "malformed request" }, { status: 400 });
  }
  if (!text?.trim()) return new Response(null, { status: 204 });

  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_TTS_MODEL;

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.slice(0, 2500),
          model_id: modelId,
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.75,
            style: 0.25,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!upstream.ok || !upstream.body) {
      return new Response(null, {
        status: 204,
        headers: { "X-Apex-Tts-Fallback": `upstream ${upstream.status}` },
      });
    }

    return new Response(upstream.body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(null, {
      status: 204,
      headers: { "X-Apex-Tts-Fallback": "network" },
    });
  }
}
