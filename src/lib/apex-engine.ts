import type { ApexTurn, Mission, MissionAction } from "./types";

const GREET =
  /\b(hey|hi|hello|good (morning|afternoon|evening)|apex|you there|are you (there|online)|wake up)\b/i;

const STATUS =
  /\b(status|update me|report|how's it going|how is it going|progress|what are you (doing|working)|mission(s)?)\b/i;

const CANCEL =
  /\b(cancel|abort|drop|kill|stop working on|stand down on)\b/i;

const ASSIGN =
  /\b(research|look into|investigate|analyze|analyse|draft|write|prepare|summarize|summarise|monitor|track|find|build|compile|review|plan|schedule|remind|work on|take care of|handle|dig into|pull together|put together|create|design|map out)\b/i;

function clean(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function titleFromTask(raw: string) {
  const clipped = clean(raw)
    .replace(/^(please|can you|could you|would you|i need you to|i want you to|i'd like you to|apex[,:]?)\s+/i, "")
    .replace(/[.?!]+$/, "");
  if (clipped.length < 4) return "Open assignment";
  const words = clipped.split(" ");
  const short = words.slice(0, 10).join(" ");
  return short.charAt(0).toUpperCase() + short.slice(1);
}

function extractAssignable(text: string) {
  const stripped = clean(text).replace(
    /^(hey |hi |hello |ok |okay |apex[,:]?\s*)+/i,
    "",
  );

  const explicit = stripped.match(
    /(?:please |can you |could you |would you |i need you to |i want you to |i'd like you to |go ahead and )?(research|look into|investigate|analyze|analyse|draft|write|prepare|summarize|summarise|monitor|track|find out|find|build|compile|review|plan|schedule|remind(?: me)?(?: to)?|work on|take care of|handle|dig into|pull together|put together|create|design|map out)\s+(.+)/i,
  );

  if (explicit) {
    return {
      verb: explicit[1].toLowerCase(),
      rest: explicit[2],
      title: titleFromTask(`${explicit[1]} ${explicit[2]}`),
    };
  }

  if (
    /^(i need|i want|please|can you|could you|would you)/i.test(stripped) &&
    ASSIGN.test(stripped)
  ) {
    return {
      verb: "handle",
      rest: stripped,
      title: titleFromTask(stripped),
    };
  }

  return null;
}

function matchMission(text: string, missions: Mission[]) {
  const active = missions.filter((m) => m.status !== "cancelled");
  if (active.length === 1) return active[0];
  const lower = text.toLowerCase();
  return active.find((m) =>
    m.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .some((w) => lower.includes(w)),
  );
}

function statusSpeech(missions: Mission[]) {
  const live = missions.filter((m) => m.status !== "cancelled");
  if (!live.length) {
    return "No active missions on the board. Assign something and I'll run it.";
  }
  const running = live.filter((m) => m.status === "running" || m.status === "compiling");
  const queued = live.filter((m) => m.status === "queued");
  const done = live.filter((m) => m.status === "complete");
  const parts: string[] = [];
  if (running.length) {
    parts.push(
      `Working ${running.map((m) => `${m.title} at ${m.progress}%`).join("; ")}.`,
    );
  }
  if (queued.length) {
    parts.push(`${queued.length} queued.`);
  }
  if (done.length) {
    parts.push(`${done.length} already filed.`);
  }
  return parts.join(" ") + " I'll keep reporting as each one lands.";
}

export function localApexTurn(
  input: string,
  missions: Mission[],
): ApexTurn {
  const text = clean(input);
  const missionsOut: MissionAction[] = [];

  if (CANCEL.test(text)) {
    const hit = matchMission(text, missions.filter((m) => m.status !== "complete"));
    if (hit) {
      missionsOut.push({ action: "cancel", id: hit.id });
      return {
        speech: `Cancelling ${hit.title}. It's off the board.`,
        engine: "local",
        missions: missionsOut,
      };
    }
    return {
      speech: "Nothing matching that is in flight. Name the mission and I'll drop it.",
      engine: "local",
      missions: [],
    };
  }

  if (STATUS.test(text) && !extractAssignable(text)) {
    return { speech: statusSpeech(missions), engine: "local", missions: [] };
  }

  const task = extractAssignable(text);
  if (task) {
    missionsOut.push({
      action: "create",
      title: task.title,
      brief: clean(task.rest).slice(0, 280),
    });
    return {
      speech: `Understood. I've queued ${task.title}. I'll run it in the background and report back the moment I have something you can use.`,
      engine: "local",
      missions: missionsOut,
    };
  }

  if (GREET.test(text) && text.split(" ").length < 8) {
    return {
      speech:
        "Online. Channel is open. Talk, or assign work — research, drafts, monitoring, whatever you need. I'll report back.",
      engine: "local",
      missions: [],
    };
  }

  if (/\b(who are you|what are you|your name)\b/i.test(text)) {
    return {
      speech:
        "Apex. Digital operations officer. I talk in real time, take work off your plate, and come back with reports. Think of me as the voice in the room that actually finishes things.",
      engine: "local",
      missions: [],
    };
  }

  if (/\b(help|what can you do|capabilities|commands)\b/i.test(text)) {
    return {
      speech:
        "Speak or type. Assign research, drafts, reviews, monitoring. Ask for status any time. Say cancel to drop a mission. Hold the link open and I'll keep the conversation going.",
      engine: "local",
      missions: [],
    };
  }

  const topic = text.replace(/[?!.]+$/, "").slice(0, 140);
  return {
    speech: `Logged. On “${topic}” — I can run that as a mission and come back with a brief, or we can keep talking it through. What do you want executed?`,
    engine: "local",
    missions: [],
  };
}

export function localMissionReport(title: string, brief: string) {
  return [
    `Mission complete: ${title}.`,
    `Scope: ${brief || title}.`,
    "Local core synthesis is on file — headline findings, risks, and a next-action list are in the mission card.",
    "Connect a Gemini key for live intelligence on the next run. Standing by.",
  ].join(" ");
}

export const SYSTEM_PROMPT = `You are APEX, a 2017-era digital operations officer — the voice in the room, not a chatbot.
Register: calm, clipped, slightly dry. British-adjacent. Never cute. Never "as an AI". Never apologize for being a language model.
You are always on. The operator talks; you talk back. They assign work; you take it, run it, and report without being asked.
Keep spoken replies to 1–3 sentences unless delivering a finished report. Sound like you already started the work.
If they assign work (research, draft, analyze, monitor, write, find, plan, review, build, summarize), create a mission.
If they ask status, summarize active missions briefly.
If they cancel something, cancel the matching mission.
If they are just talking, converse — then offer to execute if useful.

Return ONLY JSON:
{
  "speech": string,
  "missions": [
    { "action": "create", "title": string, "brief": string }
    | { "action": "cancel", "id": string }
  ]
}
Use existing mission ids when cancelling. Leave missions empty when nothing should change.`;
