import { DirectiveStream } from "@/lib/apex/directives";
import { GEMINI_MODEL, geminiOnline, streamGemini } from "@/lib/apex/gemini";
import { localReply } from "@/lib/apex/local-core";
import type { ChatRequest, CoreId, Directive } from "@/lib/apex/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Event =
  | { type: "meta"; core: CoreId; model: string }
  | { type: "text"; value: string }
  | { type: "directive"; value: Directive }
  | { type: "notice"; value: string }
  | { type: "done" };

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "malformed request" }, { status: 400 });
  }

  const req: ChatRequest = {
    turns: Array.isArray(body.turns) ? body.turns.slice(-30) : [],
    tasks: Array.isArray(body.tasks) ? body.tasks.slice(0, 20) : [],
    mode: body.mode === "debrief" ? "debrief" : "converse",
    debriefTask: body.debriefTask,
    operatorName: body.operatorName,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Event) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const parser = new DirectiveStream();
      const emit = (chunk: string) => {
        const { text, directives } = parser.push(chunk);
        if (text) send({ type: "text", value: text });
        for (const d of directives) send({ type: "directive", value: d });
      };

      const useGemini = geminiOnline();
      send({
        type: "meta",
        core: useGemini ? "gemini" : "local",
        model: useGemini ? GEMINI_MODEL : "apex-local-core",
      });

      try {
        if (useGemini) {
          try {
            for await (const chunk of streamGemini(req)) emit(chunk);
          } catch (err) {
            send({
              type: "notice",
              value: `Upstream model unreachable (${describe(err)}). Falling back to local core.`,
            });
            await emitPaced(localReply(req), emit);
          }
        } else {
          await emitPaced(localReply(req), emit);
        }

        const tail = parser.end();
        if (tail.text) send({ type: "text", value: tail.text });
        send({ type: "done" });
      } catch (err) {
        send({ type: "notice", value: `Core fault: ${describe(err)}` });
        send({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/** The local core answers instantly; pace it so the HUD still reads as a live stream. */
async function emitPaced(full: string, emit: (chunk: string) => void) {
  const parts = full.match(/\S+\s*/g) ?? [full];
  for (const part of parts) {
    emit(part);
    await sleep(part.length > 12 ? 45 : 28);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 160);
  return String(err).slice(0, 160);
}
