import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { SYSTEM_PROMPT, localApexTurn, localMissionReport } from "./apex-engine";
import type { ApexTurn, ChatMessage, EngineKind, Mission, MissionAction } from "./types";

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-1.5-flash",
];

const turnSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    speech: { type: SchemaType.STRING },
    missions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          action: { type: SchemaType.STRING },
          id: { type: SchemaType.STRING },
          title: { type: SchemaType.STRING },
          brief: { type: SchemaType.STRING },
        },
      },
    },
  },
  required: ["speech"],
};

export function getApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ""
  );
}

export function engineKind(): EngineKind {
  return getApiKey() ? "gemini" : "local";
}

function parseTurn(raw: string, fallback: ApexTurn): ApexTurn {
  try {
    const json = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim());
    const speech = String(json.speech || "").trim();
    const missions: MissionAction[] = Array.isArray(json.missions)
      ? json.missions
          .filter((m: { action?: string }) => m?.action === "create" || m?.action === "cancel")
          .map((m: MissionAction) => ({
            action: m.action,
            id: m.id,
            title: m.title,
            brief: m.brief,
          }))
      : [];
    if (!speech) return fallback;
    return { speech, engine: "gemini", missions };
  } catch {
    return fallback;
  }
}

async function generateJson(prompt: string, system: string) {
  const key = getApiKey();
  if (!key) return null;
  const genAI = new GoogleGenerativeAI(key);
  let lastError: unknown;

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: system,
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: turnSchema,
        },
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastError = err;
    }
  }

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: system,
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastError = err;
    }
  }

  console.error("Gemini failed", lastError);
  return null;
}

export async function runApexTurn(
  messages: ChatMessage[],
  missions: Pick<Mission, "id" | "title" | "status" | "progress">[],
): Promise<ApexTurn> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const fallback = localApexTurn(
    lastUser,
    missions.map((m) => ({
      ...m,
      brief: "",
      logs: [],
      createdAt: 0,
      updatedAt: 0,
    })) as Mission[],
  );

  if (!getApiKey()) return fallback;

  const board = missions.length
    ? missions.map((m) => `- [${m.id}] ${m.title} (${m.status}, ${m.progress}%)`).join("\n")
    : "(none)";

  const history = messages
    .slice(-16)
    .map((m) => `${m.role === "user" ? "OPERATOR" : "APEX"}: ${m.content}`)
    .join("\n");

  const prompt = `ACTIVE MISSIONS:\n${board}\n\nTRANSCRIPT:\n${history}\n\nRespond to the latest operator line.`;

  const raw = await generateJson(prompt, SYSTEM_PROMPT);
  if (!raw) return fallback;
  return parseTurn(raw, fallback);
}

export async function runMissionReport(title: string, brief: string, context: string) {
  const local = localMissionReport(title, brief);
  if (!getApiKey()) return { report: local, engine: "local" as const };

  const raw = await generateJson(
    `Write a spoken field report for a completed mission.
Title: ${title}
Brief: ${brief}
Operator context: ${context.slice(0, 1200)}

JSON: { "speech": string, "missions": [] }
speech should be 4–7 sentences: what you found, why it matters, 2 concrete next moves. No preamble.`,
    SYSTEM_PROMPT,
  );

  if (!raw) return { report: local, engine: "local" as const };
  const parsed = parseTurn(raw, { speech: local, engine: "local", missions: [] });
  return { report: parsed.speech, engine: "gemini" as const };
}
