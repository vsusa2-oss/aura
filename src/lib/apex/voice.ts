export const DEFAULT_VOICE_ID = "TX3LPaxmHKxFdv7VOQHJ"; // dry, level — reads as a system voice
export const DEFAULT_TTS_MODEL = "eleven_turbo_v2_5";

export function elevenLabsKey(): string | undefined {
  const key = process.env.ELEVENLABS_API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

export function elevenLabsOnline(): boolean {
  return Boolean(elevenLabsKey());
}
