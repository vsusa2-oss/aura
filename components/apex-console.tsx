"use client";

import { CoreOrb } from "@/components/core-orb";
import { TaskPanel } from "@/components/task-panel";
import { TranscriptPanel } from "@/components/transcript-panel";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useSessionId } from "@/hooks/use-session-id";
import { useVoice } from "@/hooks/use-voice";
import { cn } from "@/lib/utils";
import {
  Mic,
  MicOff,
  Radio,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function ApexConsole() {
  const sessionId = useSessionId();
  const { lines, tasks, busy, send, refreshTasks } = useChatStream(sessionId);
  const [input, setInput] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const [autoListen, setAutoListen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleReplyWithSpeakRef = useRef<
    (text: string) => Promise<void>
  >(() => Promise.resolve());

  const voice = useVoice({
    onTranscript: (text) => {
      void handleReplyWithSpeakRef.current(text);
    },
    onSpeakingChange: setSpeaking,
  });

  const { speak, startListening, stopListening, listening, speechSupported } =
    voice;

  const handleReplyWithSpeak = useCallback(
    async (text: string) => {
      const reply = await send(text);
      if (reply && voiceMode) {
        await speak(reply);
        if (autoListen && speechSupported) {
          setTimeout(() => startListening(), 400);
        }
      }
    },
    [send, voiceMode, speak, autoListen, speechSupported, startListening],
  );

  handleReplyWithSpeakRef.current = handleReplyWithSpeak;

  useEffect(() => {
    if (sessionId) void refreshTasks();
  }, [sessionId, refreshTasks]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    void handleReplyWithSpeak(text);
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#020617] text-cyan-50">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(8,145,178,0.12),transparent_65%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 3px)",
        }}
      />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/15 px-4 py-3 md:px-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-cyan-400/70">
            Harness · Personal Liaison
          </p>
          <h1 className="text-xl font-semibold tracking-wide text-cyan-50 md:text-2xl">
            APEX <span className="font-normal text-cyan-400/80">Interface</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
          <StatusPill ok={!!sessionId} label={sessionId ? "Linked" : "Sync…"} />
          <StatusPill
            ok={speechSupported}
            label={speechSupported ? "Mic ready" : "Mic n/a"}
          />
          <StatusPill
            ok={!busy}
            label={busy ? "Processing" : "Channel open"}
          />
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-12 md:gap-5 md:p-6">
        <div className="flex flex-col items-center justify-center md:col-span-4 md:row-span-2">
          <CoreOrb
            active={!busy}
            listening={listening}
            speaking={speaking}
          />
          <p className="mt-10 max-w-xs text-center text-xs leading-relaxed text-cyan-100/45">
            Continuous dialogue with mission tracking. Speak naturally or type —
            responses stream in real time and sync to your mission log.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <ToggleButton
              active={voiceMode}
              onClick={() => setVoiceMode((v) => !v)}
              icon={voiceMode ? Volume2 : VolumeX}
              label="Voice out"
            />
            <ToggleButton
              active={autoListen}
              onClick={() => setAutoListen((v) => !v)}
              icon={Radio}
              label="Hands-free"
            />
          </div>
        </div>

        <div className="min-h-[280px] md:col-span-8 md:min-h-0 md:h-[min(52vh,520px)]">
          <TranscriptPanel lines={lines} />
        </div>

        <div className="min-h-[220px] md:col-span-8 md:min-h-0 md:h-[min(32vh,360px)]">
          <TaskPanel tasks={tasks} />
        </div>
      </main>

      <footer className="relative z-10 border-t border-cyan-500/15 bg-black/50 px-4 py-4 backdrop-blur-md md:px-8">
        <form
          onSubmit={onSubmit}
          className="mx-auto flex max-w-3xl items-center gap-2"
        >
          <button
            type="button"
            disabled={!speechSupported || busy}
            onClick={() => (listening ? stopListening() : startListening())}
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border transition",
              listening
                ? "border-teal-400/60 bg-teal-500/20 text-teal-200"
                : "border-cyan-500/25 bg-cyan-950/40 text-cyan-300 hover:border-cyan-400/50",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
            aria-label={listening ? "Stop listening" : "Start voice input"}
          >
            {listening ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Directive for APEX…"
            disabled={busy}
            className="h-12 flex-1 rounded-lg border border-cyan-500/20 bg-black/60 px-4 font-mono text-sm text-cyan-50 placeholder:text-cyan-100/30 outline-none focus:border-cyan-400/50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex h-12 items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-cyan-100/35">
          Set GEMINI_API_KEY or OPENAI_API_KEY for live reasoning · ELEVENLABS_API_KEY
          for neural voice · without keys, demo mode still tracks missions locally
        </p>
      </footer>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1",
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300/90"
          : "border-amber-500/30 bg-amber-500/10 text-amber-200/90",
      )}
    >
      {label}
    </span>
  );
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Volume2;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition",
        active
          ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
          : "border-cyan-500/15 text-cyan-100/45 hover:border-cyan-500/30",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
