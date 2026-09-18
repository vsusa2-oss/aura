import type { Task, TaskStatus } from "./types";

const globalStore = globalThis as unknown as {
  __apexTasks?: Map<string, Task[]>;
};

function getStore(): Map<string, Task[]> {
  if (!globalStore.__apexTasks) {
    globalStore.__apexTasks = new Map();
  }
  return globalStore.__apexTasks;
}

function now() {
  return new Date().toISOString();
}

function id() {
  return `tsk_${Math.random().toString(36).slice(2, 10)}`;
}

export function listTasks(sessionId: string): Task[] {
  return getStore().get(sessionId) ?? [];
}

export function createTask(
  sessionId: string,
  title: string,
  detail?: string,
): Task {
  const tasks = listTasks(sessionId);
  const task: Task = {
    id: id(),
    title,
    detail,
    status: "pending",
    createdAt: now(),
    updatedAt: now(),
  };
  tasks.push(task);
  getStore().set(sessionId, tasks);
  return task;
}

export function updateTask(
  sessionId: string,
  taskId: string,
  patch: { title?: string; detail?: string; status?: TaskStatus },
): Task | null {
  const tasks = listTasks(sessionId);
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return null;
  const updated: Task = {
    ...tasks[idx],
    ...patch,
    updatedAt: now(),
  };
  tasks[idx] = updated;
  getStore().set(sessionId, tasks);
  return updated;
}

const TASK_MARKER = /\[\[TASK:([\s\S]*?)\]\]/g;

export function extractTaskMarkers(text: string): {
  clean: string;
  markers: { raw: string; payload: unknown }[];
} {
  const markers: { raw: string; payload: unknown }[] = [];
  const clean = text.replace(TASK_MARKER, (_, json: string) => {
    try {
      markers.push({ raw: json, payload: JSON.parse(json.trim()) });
    } catch {
      markers.push({ raw: json, payload: null });
    }
    return "";
  });
  return { clean: clean.trim(), markers };
}

export function applyTaskMarkers(
  sessionId: string,
  markers: { payload: unknown }[],
): Task[] {
  const changed: Task[] = [];
  for (const { payload } of markers) {
    if (!payload || typeof payload !== "object") continue;
    const p = payload as Record<string, unknown>;
    const type = p.type as string | undefined;
    if (type === "create" && typeof p.title === "string") {
      changed.push(
        createTask(
          sessionId,
          p.title,
          typeof p.detail === "string" ? p.detail : undefined,
        ),
      );
    } else if (
      type === "update" &&
      typeof p.id === "string" &&
      typeof p.status === "string"
    ) {
      const t = updateTask(sessionId, p.id, {
        status: p.status as TaskStatus,
        title: typeof p.title === "string" ? p.title : undefined,
        detail: typeof p.detail === "string" ? p.detail : undefined,
      });
      if (t) changed.push(t);
    }
  }
  return changed;
}
