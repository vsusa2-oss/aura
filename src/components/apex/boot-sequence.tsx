"use client";

import { useEffect, useState } from "react";

const CHECKS = [
  "AUDIO CHANNEL",
  "NEURAL LINK",
  "MISSION QUEUE",
  "VOICE SYNTH",
  "OPERATOR HANDSHAKE",
];

export function BootSequence({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStep(1), 280),
      window.setTimeout(() => setStep(2), 720),
      window.setTimeout(() => setStep(3), 1280),
      window.setTimeout(() => setStep(4), 1880),
      window.setTimeout(() => setStep(5), 2480),
      window.setTimeout(() => onDone(), 3100),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [onDone]);

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/80">
      <div className="w-full max-w-md px-6">
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
      </div>
    </div>
  );
}
