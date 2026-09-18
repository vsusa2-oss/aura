import { DIRECTIVE_CLOSE, DIRECTIVE_OPEN } from "./persona";
import type { ChatRequest } from "./types";

/**
 * The fallback reasoning core. It runs entirely in-process so the deck is usable with no
 * API key at all: intent is matched against the operator's last line, and the reply is
 * assembled from the live board state rather than canned text.
 */
export function localReply(req: ChatRequest): string {
  if (req.mode === "debrief") return localDebrief(req);

  const last = [...req.turns].reverse().find((t) => t.role === "operator");
  const input = (last?.text ?? "").trim();
  const lower = input.toLowerCase();
  const pick = seededPicker(input);

  if (!input) {
    return "I'm here. Say the word and I'll start moving.";
  }

  if (matches(lower, GREETING_RE)) {
    return pick([
      "Good to hear you. Deck is quiet, so you have my whole attention.",
      "I'm up. What are we doing today?",
      "Here. Everything's warm and idle — give me something to chase.",
    ]);
  }

  if (matches(lower, IDENTITY_RE)) {
    return (
      "I'm APEX — the intelligence wired into this deck. I listen, I talk back, and I " +
      "carry work in the background while we keep talking. Right now I'm running on my " +
      "local core, which means I'm quick but I can't reach the wider model. Drop a " +
      "Gemini key into the environment and I'll come up on full reasoning."
    );
  }

  if (matches(lower, CANCEL_RE)) return cancelReply(req, lower, pick);

  if (matches(lower, STATUS_RE)) return boardSummary(req);

  if (matches(lower, THANKS_RE)) {
    return pick([
      "Any time. I'll keep the board warm.",
      "Noted. I'll stay on it.",
      "That's what I'm for.",
    ]);
  }

  if (matches(lower, CAPABILITY_RE)) {
    return (
      "I hold a continuous conversation over voice, take assignments off you, work them " +
      "in the background, and come back with a debrief when each one lands. Ask me where " +
      "something stands at any point and I'll read you the board."
    );
  }

  if (isAssignment(lower)) {
    const title = titleFrom(input);
    const steps = stepsFor(lower, title);
    const ack = pick([
      `On it. I'll take "${title}" and work it in the background while we keep talking.`,
      `Taking "${title}" now. I'll run it through ${steps.length} phases and come back to you.`,
      `Got it — "${title}" is on the board. I'll report the moment it lands.`,
    ]);
    const directive = `${DIRECTIVE_OPEN}${JSON.stringify({
      kind: "assign",
      title,
      brief: input.slice(0, 280),
      priority: /urgent|now|asap|critical|immediately/.test(lower)
        ? "critical"
        : "standard",
      steps,
    })}${DIRECTIVE_CLOSE}`;
    return `${ack} ${directive}`;
  }

  if (lower.endsWith("?") || matches(lower, QUESTION_RE)) {
    return (
      `That one needs the full model behind me and I'm on the local core right now, so ` +
      `I'd only be guessing. ` +
      pick([
        "Set a Gemini key and ask me again — I'll give you a real answer.",
        "Want me to turn it into an assignment instead? I'll work it and report back.",
        "Give me the key and I'll go get it properly.",
      ])
    );
  }

  return pick([
    `Heard you — "${clip(input)}". Tell me whether you want that answered or actioned and I'll move.`,
    `Logged. If you want me to actually run at "${clip(input)}", say so and it goes on the board.`,
    `Understood. Say the word and I'll turn that into an assignment.`,
  ]);
}

function localDebrief(req: ChatRequest): string {
  const t = req.debriefTask;
  if (!t) return "Assignment closed out. Nothing worth flagging.";
  const phases = t.steps.length;
  return (
    `"${t.title}" is done — I ran all ${numberWord(phases)} phases clean. ` +
    `Headline is that nothing blocked, so the brief stands as written. ` +
    `I'm running on the local core, so treat this as a dry run of the pipeline rather ` +
    `than real findings; wire in a Gemini key and I'll do the actual work on the next pass.`
  );
}

function cancelReply(
  req: ChatRequest,
  lower: string,
  pick: <T>(options: T[]) => T,
): string {
  const live = req.tasks.filter((t) => t.state === "running" || t.state === "queued");
  if (!live.length) {
    return "Nothing's in flight to drop. The board's already clear.";
  }

  const target =
    live.length === 1
      ? live[0]
      : live.find((t) =>
          t.title
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3)
            .some((w) => lower.includes(w)),
        );

  if (!target) {
    return `I've got ${numberWord(live.length)} running — ${live
      .map((t) => `"${t.title}"`)
      .join(", ")}. Which one do you want dropped?`;
  }

  const ack = pick([
    `Dropping "${target.title}". It's off the board.`,
    `Standing down on "${target.title}".`,
    `Done — "${target.title}" is cancelled.`,
  ]);
  const directive = `${DIRECTIVE_OPEN}${JSON.stringify({
    kind: "cancel",
    taskId: target.id,
  })}${DIRECTIVE_CLOSE}`;
  return `${ack} ${directive}`;
}

function boardSummary(req: ChatRequest): string {
  const live = req.tasks.filter((t) => t.state !== "cancelled");
  const running = live.filter((t) => t.state === "running");
  const queued = live.filter((t) => t.state === "queued");
  const done = live.filter((t) => t.state === "complete");

  if (!live.length) {
    return "Board's clear. Nothing running, nothing queued — I'm all yours.";
  }

  const parts: string[] = [];
  if (running.length) {
    parts.push(
      running
        .map((t) => `"${t.title}" is at ${Math.round(t.progress)} percent`)
        .join(", and "),
    );
  }
  if (queued.length) {
    parts.push(`${numberWord(queued.length)} waiting in the queue`);
  }
  if (done.length) {
    parts.push(`${numberWord(done.length)} already closed out`);
  }
  return `Here's where we are. ${capitalize(parts.join(". "))}.`;
}

const GREETING_RE = [
  /^(hey|hi|hello|yo|good (morning|afternoon|evening))\b/,
  /\bare you (there|awake|online|up)\b/,
  /^apex[.!?, ]*$/,
];
const IDENTITY_RE = [/\bwho are you\b/, /\bwhat are you\b/, /\byour name\b/, /\bintroduce yourself\b/];
const STATUS_RE = [
  /\b(status|progress|update|where (are|do) we|how.s it going|board|what.s running)\b/,
  /\bhow far\b/,
  /\bany(thing)? (done|finished|left)\b/,
];
const THANKS_RE = [/\b(thanks|thank you|nice work|good job|appreciate)\b/];
const CANCEL_RE = [
  /\b(cancel|abort|stand down|call it off|drop (it|that|the)|forget (it|that|the))\b/,
  /\bstop working on\b/,
  /\bnever mind\b/,
];
const CAPABILITY_RE = [
  /\bwhat can you (do|handle)\b/,
  /\byour (capabilities|abilities|skills)\b/,
  /\bhow do you work\b/,
];
const QUESTION_RE = [/^(what|why|how|when|where|who|which|is|are|can|could|should|does|do)\b/];

const ASSIGNMENT_RE = [
  /\b(look into|research|dig into|investigate|find out|figure out)\b/,
  /\b(draft|write|compose|put together|prepare|build|design|outline|summar(y|ise|ize))\b/,
  /\b(track|monitor|watch|keep an eye|follow up)\b/,
  /\b(analy(s|z)e|review|audit|compare|benchmark|scan)\b/,
  /\b(plan|schedule|organi(s|z)e|coordinate)\b/,
  /^(go|start|begin|run|handle|take care of|sort out|deal with)\b/,
];

function isAssignment(lower: string): boolean {
  if (lower.endsWith("?") && !/^(can|could|would) you\b/.test(lower)) return false;
  return matches(lower, ASSIGNMENT_RE);
}

function matches(s: string, res: RegExp[]): boolean {
  return res.some((r) => r.test(s));
}

function titleFrom(input: string): string {
  const stripped = input
    .replace(/^\s*(hey |ok(ay)? )?apex\b[,:.!\s]*/i, "")
    .replace(/^(please |could you |can you |would you |i want you to |i need you to |go ahead and )/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  const words = stripped.split(/\s+/).slice(0, 8).join(" ");
  return capitalize(words || "Unnamed assignment").slice(0, 72);
}

function stepsFor(lower: string, title: string): string[] {
  if (matches(lower, [/\b(research|look into|investigate|find out|dig into)\b/])) {
    return [
      "Framing the question",
      "Sweeping available sources",
      "Filtering out the noise",
      "Cross-checking the strongest leads",
      "Writing the debrief",
    ];
  }
  if (matches(lower, [/\b(draft|write|compose|outline|prepare|summar)\b/])) {
    return [
      "Pulling the source material",
      "Sketching the structure",
      "Drafting the body",
      "Tightening the language",
    ];
  }
  if (matches(lower, [/\b(analy|review|audit|compare|benchmark|scan)\b/])) {
    return [
      "Loading the inputs",
      "Running the comparison",
      "Flagging the outliers",
      "Scoring the result",
    ];
  }
  if (matches(lower, [/\b(track|monitor|watch|keep an eye)\b/])) {
    return ["Setting the watch", "Establishing a baseline", "Sampling for drift", "Preparing alerts"];
  }
  return [
    `Parsing "${title}"`,
    "Planning the approach",
    "Executing the work",
    "Verifying the output",
  ];
}

/** Deterministic per-input variety, so repeated phrasing doesn't loop the same line. */
function seededPicker(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const seed = Math.abs(h);
  return <T>(options: T[]): T => options[seed % options.length];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function clip(s: string): string {
  return s.length > 60 ? `${s.slice(0, 57)}...` : s;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
function numberWord(n: number): string {
  return WORDS[n] ?? String(n);
}
