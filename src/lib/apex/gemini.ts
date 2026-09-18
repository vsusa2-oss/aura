import { GoogleGenAI } from "@google/genai";
import { debriefPrompt, systemPrompt } from "./persona";
import type { ChatRequest } from "./types";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export function geminiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

export function geminiOnline(): boolean {
  return Boolean(geminiKey());
}

export async function* streamGemini(req: ChatRequest): AsyncGenerator<string> {
  const apiKey = geminiKey();
  if (!apiKey) throw new Error("no gemini key");

  const ai = new GoogleGenAI({ apiKey });
  const contents = req.turns.slice(-24).map((t) => ({
    role: t.role === "operator" ? ("user" as const) : ("model" as const),
    parts: [{ text: t.text }],
  }));

  if (req.mode === "debrief") {
    contents.push({
      role: "user",
      parts: [{ text: "The assignment just finished. Give me the debrief." }],
    });
  }

  const stream = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction:
        req.mode === "debrief" ? debriefPrompt(req) : systemPrompt(req),
      temperature: 0.85,
      topP: 0.95,
      maxOutputTokens: 700,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}
