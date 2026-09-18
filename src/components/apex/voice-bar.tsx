"use client";

import { Mic, MicOff, Radio, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function VoiceBar({
  value,
  onChange,
  onSubmit,
  listening,
  linkOpen,
  onToggleLink,
  disabled,
  micError,
  sttSupported,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  listening: boolean;
  linkOpen: boolean;
  onToggleLink: () => void;
  disabled?: boolean;
  micError?: string | null;
  sttSupported: boolean;
}) {
  return (
    <div className="hud-panel bg-black/40 p-3">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <Button
          type="button"
          variant="mic"
          size="icon"
          onClick={onToggleLink}
          disabled={!sttSupported}
          aria-pressed={linkOpen}
          aria-label={linkOpen ? "Close voice link" : "Open voice link"}
          className={cn(
            "mx-auto size-14 shrink-0 sm:mx-0",
            listening && "mic-live border-emerald-300 bg-emerald-400/20 text-emerald-50",
            linkOpen && !listening && "border-cyan-200",
          )}
        >
          {linkOpen ? <Mic className="size-6" /> : <MicOff className="size-6" />}
        </Button>

        <div className="min-w-0 flex-1">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Talk or type — assign work, ask for status, keep the channel open."
            disabled={disabled}
            aria-label="Transmit to Apex"
          />
          <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] tracking-widest text-cyan-400/55">
            {micError
              ? micError.toUpperCase()
              : linkOpen
                ? listening
                  ? "VOICE LINK LIVE — SPEAK"
                  : "VOICE LINK ARMED"
                : sttSupported
                  ? "VOICE LINK CLOSED — TAP MIC TO OPEN"
                  : "VOICE UNAVAILABLE — TEXT ONLY"}
          </p>
        </div>

        <Button
          type="submit"
          variant="hud"
          disabled={disabled || !value.trim()}
          className="h-11 px-5"
        >
          <Send className="size-4" />
          Transmit
        </Button>
      </form>
      <p className="mt-2 hidden items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] text-cyan-500/50 sm:flex">
        <Radio className="size-3" />
        Continuous conversation. After Apex speaks, the link listens again.
      </p>
    </div>
  );
}
