"use client";

import { useState } from "react";
import { CornerDownLeft, Mic, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onSubmit: (text: string) => void;
  onToggleMic: () => void;
  onInterrupt: () => void;
  micOpen: boolean;
  micSupported: boolean;
  busy: boolean;
  speaking: boolean;
}

export function CommandBar({
  onSubmit,
  onToggleMic,
  onInterrupt,
  micOpen,
  micSupported,
  busy,
  speaking,
}: Props) {
  const [value, setValue] = useState("");

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    setValue("");
    onSubmit(text);
  };

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Button
        type="button"
        size="icon"
        variant={micOpen ? "default" : "outline"}
        onClick={onToggleMic}
        disabled={!micSupported}
        aria-pressed={micOpen}
        aria-label={micOpen ? "Close the microphone" : "Open the microphone"}
        title={
          micSupported
            ? micOpen
              ? "Close the microphone"
              : "Open the microphone"
            : "This browser has no speech recognition — use Chrome or Edge"
        }
        className={cn(
          "hud-notch relative size-10 shrink-0",
          micOpen && "shadow-[0_0_22px_-4px_var(--primary)]",
        )}
      >
        {micSupported ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        {micOpen && (
          <span className="pointer-events-none absolute inset-0 animate-ping rounded-[inherit] border border-primary/60" />
        )}
      </Button>

      <div className="hud-notch relative flex-1">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            micOpen ? "Listening — or type here…" : "Type a message or an assignment…"
          }
          aria-label="Message APEX"
          className="h-10 w-full border border-input bg-card/60 pr-10 pl-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
        />
        <CornerDownLeft className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground/40" />
      </div>

      {speaking ? (
        <Button
          type="button"
          variant="outline"
          onClick={onInterrupt}
          className="hud-notch h-10 shrink-0 gap-2 font-mono text-[11px] tracking-widest uppercase"
        >
          <Square className="size-3 fill-current" />
          <span className="hidden sm:inline">Cut in</span>
        </Button>
      ) : (
        <Button
          type="submit"
          disabled={busy || !value.trim()}
          className="hud-notch h-10 shrink-0 px-4 font-mono text-[11px] tracking-widest uppercase"
        >
          Send
        </Button>
      )}
    </form>
  );
}
