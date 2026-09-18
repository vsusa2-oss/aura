import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import type { ChatMessage } from "./types";

export async function* streamAssistantReply(
  messages: ChatMessage[],
): AsyncGenerator<string, void, unknown> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    yield* streamGemini(geminiKey, messages);
    return;
  }

  if (openaiKey) {
    yield* streamOpenAI(openaiKey, messages);
    return;
  }

  yield* streamDemo(messages);
}

async function* streamGemini(
  apiKey: string,
  messages: ChatMessage[],
): AsyncGenerator<string, void, unknown> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const system = messages.find((m) => m.role === "system")?.content;
  const dialogue = messages.filter((m) => m.role !== "system");

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    systemInstruction: system,
  });

  const history = dialogue.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const last = dialogue[dialogue.length - 1];
  if (!last || last.role !== "user") {
    yield "Operator, I did not receive a valid input frame.";
    return;
  }

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(last.content);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

async function* streamOpenAI(
  apiKey: string,
  messages: ChatMessage[],
): AsyncGenerator<string, void, unknown> {
  const client = new OpenAI({ apiKey });
  const stream = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
    stream: true,
  });

  for await (const part of stream) {
    const delta = part.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

async function* streamDemo(
  messages: ChatMessage[],
): AsyncGenerator<string, void, unknown> {
  const last = messages[messages.length - 1]?.content ?? "";
  const lower = last.toLowerCase();

  let reply =
    "Operator, I am online in demonstration mode. Configure GEMINI_API_KEY or OPENAI_API_KEY for full cognition. How may I assist?";

  if (lower.includes("status") || lower.includes("report")) {
    reply =
      "Systems nominal. Voice link active. Mission queue awaiting your directives. Demo mode limits external reasoning — assign a task and I will log it locally.";
  } else if (
    lower.includes("deploy") ||
    lower.includes("build") ||
    lower.includes("create")
  ) {
    reply =
      'Acknowledged. Logging mission now.\n[[TASK:{"type":"create","title":"Execute operator directive","detail":"Parsed from: ' +
      last.slice(0, 80).replace(/"/g, "'") +
      '"}]]\nI will report progress on this channel.';
  } else if (lower.includes("hello") || lower.includes("hey")) {
    reply =
      "Good to see you, Operator. APEX interface is synchronized. Speak or type — I will mirror responses on the mission log when you assign work.";
  }

  for (const word of reply.split(/(\s+)/)) {
    await sleep(18 + Math.random() * 25);
    yield word;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
