"use client";

const CHECKS = [
  "AUDIO CHANNEL",
  "NEURAL LINK",
  "MISSION QUEUE",
  "VOICE SYNTH",
  "OPERATOR HANDSHAKE",
];

export function BootSequence({
  step,
  onSkip,
}: {
  step: number;
  onSkip: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/80">
      <button
        type="button"
        onClick={onSkip}
        className="w-full max-w-md px-6 text-left"
        aria-label="Skip boot sequence"
      >
        <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.55em] text-cyan-300">
          APEX BOOT
        </p>
        <p className="mt-2 font-[family-name:var(--font-mono)] text-xs tracking-[0.3em] text-cyan-500">
          CORE 2017.9 // DIGITAL OFFICER
        </p>
        <ul className="mt-8 space-y-2">
          {CHECKS.map((line, i) => (
            <li
              key={line}
              className="flex items-center justify-between font-[family-name:var(--font-mono)] text-xs tracking-[0.22em]"
            >
              <span className={i < step ? "text-cyan-100" : "text-cyan-800"}>
                {line}
              </span>
              <span className={i < step ? "text-emerald-300" : "text-cyan-900"}>
                {i < step ? "OK" : "..."}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-8 h-px w-full overflow-hidden bg-cyan-950">
          <div
            className="h-full bg-cyan-300 transition-all duration-700"
            style={{ width: `${Math.min(100, step * 20)}%` }}
          />
        </div>
        <p className="mt-6 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.28em] text-cyan-600">
          CLICK TO ENTER
        </p>
      </button>
    </div>
  );
}
