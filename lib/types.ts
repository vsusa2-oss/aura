export type TaskStatus = "pending" | "in_progress" | "completed" | "blocked";

export type Task = {
  id: string;
  title: string;
  detail?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "task"; task: Task }
  | { type: "tasks"; tasks: Task[] }
  | { type: "error"; message: string }
  | { type: "done"; assistantMessage: string };

export type TaskMarkerPayload = {
  type: "create" | "update";
  id?: string;
  title?: string;
  detail?: string;
  status?: TaskStatus;
};
