"use client";

import type { LinkState } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATE_COPY: Record<LinkState, string> = {
  boot: "INITIALIZING",
  standby: "STANDBY",
  listening: "LISTENING",
  thinking: "THINKING",
  speaking: "SPEAKING",
  reporting: "REPORTING",
};

export function CoreOrb({
  state,
  level = 0.2,
}: {
  state: LinkState;
  level?: number;
}) {
  const hot = state === "listening" || state === "speaking" || state === "reporting";
  const think = state === "thinking";

  return (
    <div className="relative mx-auto grid place-items-center aspect-square w-[min(72vw,28rem)]">
      <div
        className={cn(
          "pointer-events-none absolute inset-[-8%] rounded-full blur-3xl transition-all duration-700",
          state === "listening" && "bg-emerald-400/20",
          state === "speaking" && "bg-cyan-300/25",
          state === "thinking" && "bg-amber-400/20",
          state === "reporting" && "bg-fuchsia-400/20",
          state === "standby" && "bg-cyan-500/12",
          state === "boot" && "bg-cyan-400/25",
        )}
      />

      <svg viewBox="0 0 400 400" className="relative z-10 h-full w-full">
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d7fbff" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#00e5ff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#00313a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g className="origin-center animate-spin-slower" style={{ transformOrigin: "200px 200px" }}>
          <circle
            cx="200"
            cy="200"
            r="168"
            fill="none"
            stroke="rgba(0,229,255,0.28)"
            strokeWidth="1.2"
            strokeDasharray="4 10"
          />
          {[0, 45, 90, 135].map((deg) => (
            <circle
              key={deg}
              cx={200 + 168 * Math.cos((deg * Math.PI) / 180)}
              cy={200 + 168 * Math.sin((deg * Math.PI) / 180)}
              r="2.4"
              fill="#7af6ff"
            />
          ))}
        </g>

        <g className="origin-center animate-spin-reverse" style={{ transformOrigin: "200px 200px" }}>
          <circle
            cx="200"
            cy="200"
            r="138"
            fill="none"
            stroke="rgba(0,229,255,0.45)"
            strokeWidth="1.4"
            strokeDasharray="70 18"
          />
        </g>

        <circle
          cx="200"
          cy="200"
          r="108"
          fill="none"
          stroke="rgba(122,246,255,0.35)"
          strokeWidth="0.8"
          className={cn(think && "animate-pulse")}
        />

        <polygon
          points="200,78 322,200 200,322 78,200"
          fill="none"
          stroke="rgba(0,229,255,0.22)"
          strokeWidth="0.8"
          className="origin-center animate-spin-slow"
          style={{ transformOrigin: "200px 200px" }}
        />

        <circle
          cx="200"
          cy="200"
          r={36 + level * 22}
          fill="url(#coreGlow)"
          className={cn("transition-all duration-200", hot && "animate-core-pulse")}
        />
        <circle
          cx="200"
          cy="200"
          r="18"
          fill={state === "listening" ? "#6dffc3" : state === "thinking" ? "#ffc14a" : "#e7fdff"}
          className="animate-core-pulse"
        />
      </svg>

      <div className="pointer-events-none absolute inset-x-10 bottom-[18%] flex h-10 items-end justify-center gap-[3px]">
        {Array.from({ length: 28 }).map((_, i) => {
          const wave =
            8 +
            Math.abs(Math.sin((i / 28) * Math.PI * 3 + (hot ? 1 : 0.2))) *
              (hot ? 22 + level * 18 : 8);
          return (
            <span
              key={i}
              className={cn(
                "w-[3px] rounded-full bg-cyan-300/80",
                hot ? "animate-eq" : "opacity-50",
              )}
              style={{
                height: `${wave}px`,
                animationDelay: `${i * 40}ms`,
              }}
            />
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-[12%] text-center">
        <p className="font-[family-name:var(--font-display)] text-[11px] tracking-[0.55em] text-cyan-200/80">
          APEX CORE
        </p>
        <p
          className={cn(
            "mt-1 font-[family-name:var(--font-mono)] text-xs tracking-[0.42em]",
            state === "listening" && "text-emerald-300",
            state === "thinking" && "text-amber-300",
            state === "speaking" && "text-cyan-100",
            state === "reporting" && "text-fuchsia-300",
            (state === "standby" || state === "boot") && "text-cyan-300/80",
          )}
        >
          {STATE_COPY[state]}
        </p>
      </div>
    </div>
  );
}
