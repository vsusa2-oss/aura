import { streamAssistantReply } from "@/lib/ai-stream";
import { APEX_SYSTEM_PROMPT } from "@/lib/system-prompt";
import {
  applyTaskMarkers,
  extractTaskMarkers,
  listTasks,
} from "@/lib/task-store";
import type { ChatMessage, StreamEvent } from "@/lib/types";

export const runtime = "nodejs";

function encode(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(req: Request) {
  let body: {
    sessionId?: string;
    messages?: ChatMessage[];
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }

  const sessionId = body.sessionId?.trim() || "default";
  const incoming = body.messages ?? [];
  if (incoming.length === 0) {
    return new Response(JSON.stringify({ error: "No messages" }), {
      status: 400,
    });
  }

  const tasks = listTasks(sessionId);
  const taskContext =
    tasks.length > 0
      ? `\n\nCurrent mission log (use these ids for updates):\n${tasks
          .map(
            (t) =>
              `- ${t.id}: [${t.status}] ${t.title}${t.detail ? ` — ${t.detail}` : ""}`,
          )
          .join("\n")}`
      : "";

  const messages: ChatMessage[] = [
    { role: "system", content: APEX_SYSTEM_PROMPT + taskContext },
    ...incoming.filter((m) => m.role !== "system"),
  ];

  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      try {
        for await (const chunk of streamAssistantReply(messages)) {
          full += chunk;
          controller.enqueue(
            encode({ type: "delta", text: chunk }),
          );
        }

        const { clean, markers } = extractTaskMarkers(full);
        const taskUpdates = applyTaskMarkers(sessionId, markers);

        for (const task of taskUpdates) {
          controller.enqueue(encode({ type: "task", task }));
        }

        controller.enqueue(
          encode({
            type: "done",
            assistantMessage: clean || full.replace(/\[\[TASK:[\s\S]*?\]\]/g, "").trim(),
          }),
        );
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Stream failed";
        controller.enqueue(encode({ type: "error", message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
