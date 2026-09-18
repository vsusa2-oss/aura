export type LinkState =
  | "boot"
  | "standby"
  | "listening"
  | "thinking"
  | "speaking"
  | "reporting";

export type EngineKind = "gemini" | "local";

export type MissionStatus =
  | "queued"
  | "running"
  | "compiling"
  | "complete"
  | "cancelled";

export type MissionLog = {
  at: string;
  line: string;
};

export type Mission = {
  id: string;
  title: string;
  brief: string;
  status: MissionStatus;
  progress: number;
  logs: MissionLog[];
  report?: string;
  createdAt: number;
  updatedAt: number;
};

export type ChatRole = "operator" | "apex" | "system";

export type TranscriptEntry = {
  id: string;
  role: ChatRole;
  text: string;
  at: number;
};

export type MissionAction = {
  action: "create" | "cancel";
  id?: string;
  title?: string;
  brief?: string;
};

export type ApexTurn = {
  speech: string;
  engine: EngineKind;
  missions: MissionAction[];
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
