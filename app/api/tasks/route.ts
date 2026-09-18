import {
  createTask,
  listTasks,
  updateTask,
} from "@/lib/task-store";
import type { TaskStatus } from "@/lib/types";

export async function GET(req: Request) {
  const sessionId =
    new URL(req.url).searchParams.get("sessionId")?.trim() || "default";
  return Response.json({ tasks: listTasks(sessionId) });
}

export async function POST(req: Request) {
  let body: {
    sessionId?: string;
    action?: "create" | "update";
    title?: string;
    detail?: string;
    id?: string;
    status?: TaskStatus;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim() || "default";

  if (body.action === "create" && body.title) {
    const task = createTask(sessionId, body.title, body.detail);
    return Response.json({ task });
  }

  if (body.action === "update" && body.id && body.status) {
    const task = updateTask(sessionId, body.id, {
      status: body.status,
      title: body.title,
      detail: body.detail,
    });
    if (!task) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }
    return Response.json({ task });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
