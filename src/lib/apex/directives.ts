import { DIRECTIVE_CLOSE, DIRECTIVE_OPEN } from "./persona";
import type { Directive } from "./types";

/**
 * Pulls `@@APEX{...}@@` control tokens out of a reply while it is still arriving.
 *
 * Chunk boundaries can land anywhere, including the middle of a token, so the parser
 * holds back any tail that could still turn out to be the start of one.
 */
export class DirectiveStream {
  private buffer = "";
  private inDirective = false;

  push(chunk: string): { text: string; directives: Directive[] } {
    this.buffer += chunk;
    let text = "";
    const directives: Directive[] = [];

    for (;;) {
      if (this.inDirective) {
        const end = this.buffer.indexOf(DIRECTIVE_CLOSE);
        if (end === -1) return { text, directives };
        const parsed = parseDirective(this.buffer.slice(0, end));
        if (parsed) directives.push(parsed);
        this.buffer = this.buffer.slice(end + DIRECTIVE_CLOSE.length);
        this.inDirective = false;
        continue;
      }

      const start = this.buffer.indexOf(DIRECTIVE_OPEN);
      if (start !== -1) {
        text += this.buffer.slice(0, start);
        this.buffer = this.buffer.slice(start + DIRECTIVE_OPEN.length);
        this.inDirective = true;
        continue;
      }

      const hold = partialPrefixLength(this.buffer, DIRECTIVE_OPEN);
      text += this.buffer.slice(0, this.buffer.length - hold);
      this.buffer = this.buffer.slice(this.buffer.length - hold);
      return { text, directives };
    }
  }

  /** Flush whatever is left once the model is done. */
  end(): { text: string } {
    const text = this.inDirective ? "" : this.buffer;
    this.buffer = "";
    this.inDirective = false;
    return { text };
  }
}

/** Length of the longest suffix of `s` that is also a prefix of `token`. */
function partialPrefixLength(s: string, token: string): number {
  const max = Math.min(s.length, token.length - 1);
  for (let n = max; n > 0; n--) {
    if (s.endsWith(token.slice(0, n))) return n;
  }
  return 0;
}

function parseDirective(raw: string): Directive | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const d = value as Record<string, unknown>;

  switch (d.kind) {
    case "assign": {
      const steps = Array.isArray(d.steps)
        ? d.steps.filter((s): s is string => typeof s === "string" && s.length > 0)
        : [];
      if (typeof d.title !== "string" || !d.title.trim()) return null;
      return {
        kind: "assign",
        title: d.title.trim().slice(0, 72),
        brief: typeof d.brief === "string" ? d.brief.slice(0, 280) : d.title.trim(),
        priority:
          d.priority === "low" || d.priority === "critical" ? d.priority : "standard",
        steps: (steps.length ? steps : DEFAULT_STEPS).slice(0, 6),
      };
    }
    case "focus":
      if (d.panel === "tasks" || d.panel === "transcript" || d.panel === "telemetry") {
        return { kind: "focus", panel: d.panel };
      }
      return null;
    case "status":
      return { kind: "status", taskId: typeof d.taskId === "string" ? d.taskId : undefined };
    case "cancel":
      return { kind: "cancel", taskId: typeof d.taskId === "string" ? d.taskId : undefined };
    default:
      return null;
  }
}

const DEFAULT_STEPS = [
  "Parsing the assignment",
  "Gathering what I can reach",
  "Cross-checking the result",
  "Writing the debrief",
];
