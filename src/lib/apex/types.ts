export type Speaker = "operator" | "apex" | "system";

export type MessageStatus = "streaming" | "complete" | "error";

export interface Message {
  id: string;
  speaker: Speaker;
  text: string;
  at: number;
  status: MessageStatus;
  /** Set when the message is APEX reporting on a finished assignment. */
  taskId?: string;
  /** Which inference core produced the message. */
  core?: CoreId;
}

export type CoreId = "gemini" | "local";

export type TaskState = "queued" | "running" | "complete" | "failed";

export interface TaskStep {
  label: string;
  state: "pending" | "active" | "done";
}

export interface Task {
  id: string;
  title: string;
  brief: string;
  priority: "low" | "standard" | "critical";
  state: TaskState;
  steps: TaskStep[];
  progress: number;
  createdAt: number;
  completedAt?: number;
  report?: string;
}

/** Structured instruction APEX embeds in its reply stream. */
export type Directive =
  | {
      kind: "assign";
      title: string;
      brief: string;
      priority: Task["priority"];
      steps: string[];
    }
  | { kind: "status"; taskId?: string }
  | { kind: "cancel"; taskId?: string }
  | { kind: "focus"; panel: "tasks" | "transcript" | "telemetry" };

export interface ChatTurn {
  role: "operator" | "apex";
  text: string;
}

export interface ChatRequest {
  turns: ChatTurn[];
  /** Live snapshot of the assignment board so APEX can answer "where are we at?". */
  tasks: Array<Pick<Task, "id" | "title" | "state" | "progress">>;
  /** Report mode asks for a debrief on one finished assignment. */
  mode?: "converse" | "debrief";
  debriefTask?: Pick<Task, "title" | "brief" | "steps">;
  operatorName?: string;
}

export interface Capabilities {
  reasoning: { core: CoreId; label: string; online: boolean };
  voice: { core: "elevenlabs" | "browser"; label: string; online: boolean };
  model?: string;
}
