"use client";

const STARTERS = [
  {
    label: "Assign work",
    prompt: "Look into why our signup funnel dropped last week and summarise what you find.",
  },
  {
    label: "Draft something",
    prompt: "Draft the release note for version two point one.",
  },
  { label: "Ask for status", prompt: "Where are we at?" },
  { label: "Drop it", prompt: "Cancel that last one." },
];

/** Shown until the operator says something, then it gets out of the way. */
export function Suggestions({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <span className="hud-label mr-1">Try</span>
      {STARTERS.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => onPick(s.prompt)}
          title={s.prompt}
          className="hud-notch border border-primary/25 bg-card/50 px-2.5 py-1 font-mono text-[10px] tracking-widest text-primary/80 uppercase transition-colors hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
