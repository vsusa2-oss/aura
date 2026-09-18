import { NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const systemInstruction = `You are APEX, an adaptive personal executive assistant.
Be direct, calm, capable, and concise. Acknowledge assigned work, explain what you
can actually complete, and report the result clearly. Never pretend that you ran
external actions or accessed systems that were not provided. Keep replies under
120 words unless the user asks for detail.`;

function localResponse(message: string) {
  const normalized = message.toLowerCase();

  if (/\b(hello|hi|hey|good morning|good evening)\b/.test(normalized)) {
    return "Online and listening, Vivek. Your command channel is clear. What would you like me to analyze, organize, or prepare?";
  }
  if (/\b(status|progress|report|update)\b/.test(normalized)) {
    return "Status report: the command was received, the conversation link is stable, and the operation log has been updated. This prototype is running in local mode, so I can organize and reason here, but external actions require a connected AI provider or tool.";
  }
  if (/\b(plan|organize|schedule|roadmap)\b/.test(normalized)) {
    return `Directive understood. I suggest three phases: first define the exact outcome, then break it into the smallest verifiable actions, and finally review the result against your success criteria. Tell me the deadline and constraints, and I’ll turn “${message}” into an actionable brief.`;
  }
  if (/\b(analyze|review|research|summarize)\b/.test(normalized)) {
    return `Analysis request logged. I can complete it once you provide the source material or connect a live model with browsing tools. For now, I’ve captured the objective: “${message}”. I’ll keep the report concise, evidence-based, and organized by findings, risks, and next actions.`;
  }
  return `Directive received: “${message}”. I’ve added it to the operation log. This demo is using its local intelligence fallback; connect Gemini with GEMINI_API_KEY for richer, continuous responses. What outcome should I optimize for?`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { messages?: ChatMessage[] };
    const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    const lastMessage = messages.at(-1)?.content?.trim();

    if (!lastMessage) {
      return NextResponse.json({ error: "A message is required." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: localResponse(lastMessage), mode: "local" });
    }

    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      console.error("Gemini request failed:", response.status);
      return NextResponse.json({ message: localResponse(lastMessage), mode: "local" });
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const message = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    return NextResponse.json({
      message: message || localResponse(lastMessage),
      mode: message ? "live" : "local",
    });
  } catch {
    return NextResponse.json(
      { error: "The assistant could not process this request." },
      { status: 500 },
    );
  }
}
