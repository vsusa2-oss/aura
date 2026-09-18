"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Headphones,
  Radio,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { BootSequence } from "@/components/apex/boot-sequence";
import { CommandBar } from "@/components/apex/command-bar";
import { ReactorCore } from "@/components/apex/reactor-core";
import { TaskBoard } from "@/components/apex/task-board";
import { Telemetry } from "@/components/apex/telemetry";
import { Transcript } from "@/components/apex/transcript";
import { Waveform } from "@/components/apex/waveform";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApex, type DeckStatus } from "@/hooks/use-apex";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useVoice } from "@/hooks/use-voice";
import { audioBus } from "@/lib/apex/audio-bus";
import { cn } from "@/lib/utils";

export function ApexDeck() {
  const [engaged, setEngaged] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [voiceOut, setVoiceOut] = useState(true);
  const [bargeIn, setBargeIn] = useState(false);
  const [bootedAt] = useState(() => Date.now());

  const speakingRef = useRef(false);
  const voice = useVoice({
    enabled: voiceOut,
    onSpeakingChange: (s) => {
      speakingRef.current = s;
    },
  });

  const apex = useApex({ speak: voice.speak, cancelSpeech: voice.cancel });
  const { send } = apex;

  const handleUtterance = useCallback(
    (text: string) => {
      void send(text);
    },
    [send],
  );

  const mic = useSpeechRecognition({ onUtterance: handleUtterance });

  // Half-duplex by default: the mic closes while APEX holds the floor so it never
  // transcribes its own voice back into the conversation. Barge-in mode is for headphones.
  const micShouldBeOpen =
    engaged && handsFree && mic.supported && (bargeIn || (!voice.speaking && !apex.thinking));

  useEffect(() => {
    if (micShouldBeOpen) mic.start();
    else mic.stop();
  }, [micShouldBeOpen, mic]);

  useEffect(() => {
    if (!engaged || !handsFree) return;
    void audioBus().startMic();
    return () => {
      if (!handsFree) audioBus().stopMic();
    };
  }, [engaged, handsFree]);

  // In barge-in mode, the first syllable out of the operator cuts APEX off.
  useEffect(() => {
    if (bargeIn && mic.interim.trim().length > 2 && voice.speaking) voice.cancel();
  }, [bargeIn, mic.interim, voice]);

  const status: DeckStatus = voice.speaking
    ? "speaking"
    : apex.thinking
      ? "thinking"
      : mic.listening
        ? "listening"
        : "standby";

  const caption = useMemo(() => {
    if (status === "speaking") return "Reporting back";
    if (status === "thinking") return apex.core === "gemini" ? "Querying the model" : "Local core working";
    if (status === "listening") return mic.interim ? "Catching that…" : "Channel open";
    return handsFree ? "Mic parked — APEX has the floor" : "Type or open the mic";
  }, [status, apex.core, mic.interim, handsFree]);

  const engage = useCallback(
    async (wantsHandsFree: boolean) => {
      setEngaged(true);
      setHandsFree(wantsHandsFree);
      await audioBus().resume();
      if (wantsHandsFree) await audioBus().startMic();
      apex.greet();
    },
    [apex],
  );

  const toggleMic = useCallback(() => {
    setHandsFree((open) => {
      const next = !open;
      if (next) void audioBus().startMic();
      else audioBus().stopMic();
      return next;
    });
  }, []);

  const running = apex.tasks.filter((t) => t.state === "running").length;
  const completed = apex.tasks.filter((t) => t.state === "complete").length;
  const exchanges = apex.messages.filter((m) => m.speaker === "operator").length;

  return (
    <div className="hud-grid hud-scanlines relative flex h-dvh flex-col overflow-hidden">
      <Backdrop />

      {!engaged && <BootSequence capabilities={apex.capabilities} onEngage={engage} />}

      <Header
        status={status}
        core={apex.core}
        handsFree={handsFree}
        voiceOut={voiceOut}
        bargeIn={bargeIn}
        micSupported={mic.supported}
        onToggleVoice={() => setVoiceOut((v) => !v)}
        onToggleBargeIn={() => setBargeIn((b) => !b)}
        onClear={apex.clear}
      />

      {(apex.notice || mic.error) && (
        <Notice
          text={apex.notice ?? mic.error ?? ""}
          onDismiss={apex.dismissNotice}
        />
      )}

      {/* Desktop: transcript · reactor · board. Mobile: reactor over a tabbed stack. */}
      <main className="relative z-10 min-h-0 flex-1 gap-3 p-3 lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)_minmax(0,0.9fr)]">
        <Panel title="Transcript" hint="live" className="hidden min-h-0 lg:flex">
          <Transcript
            messages={apex.messages}
            interim={mic.interim}
            thinking={apex.thinking}
          />
        </Panel>

        <section className="flex min-h-0 flex-col items-center justify-between gap-3">
          <div className="flex min-h-0 flex-1 items-center justify-center py-1">
            <ReactorCore status={status} caption={caption} />
          </div>

          <div className="hud-notch hud-panel w-full shrink-0 px-3 py-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="hud-label">
                {status === "speaking" ? "Output spectrum" : "Input spectrum"}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/60">
                {voice.path === "elevenlabs" ? "ELEVENLABS" : voiceOut ? "ON-DEVICE" : "MUTED"}
              </span>
            </div>
            <Waveform status={status} />
          </div>

          <div className="w-full shrink-0">
            <CommandBar
              onSubmit={(text) => void apex.send(text)}
              onToggleMic={toggleMic}
              onInterrupt={voice.cancel}
              micOpen={handsFree && mic.supported}
              micSupported={mic.supported}
              busy={apex.thinking}
              speaking={voice.speaking}
            />
          </div>
        </section>

        <div className="hidden min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3 lg:grid">
          <Panel
            title="Assignments"
            hint={running ? `${running} running` : "idle"}
            className="min-h-0"
          >
            <TaskBoard tasks={apex.tasks} />
          </Panel>
          <Panel title="Telemetry">
            <Telemetry
              capabilities={apex.capabilities}
              bootedAt={bootedAt}
              exchanges={exchanges}
              running={running}
              completed={completed}
              micOpen={handsFree && mic.listening}
            />
          </Panel>
        </div>

        <Tabs defaultValue="transcript" className="mt-3 min-h-0 lg:hidden">
          <TabsList className="hud-notch w-full bg-card/60">
            <TabsTrigger value="transcript" className="font-mono text-[11px] tracking-widest uppercase">
              Log
            </TabsTrigger>
            <TabsTrigger value="tasks" className="font-mono text-[11px] tracking-widest uppercase">
              Tasks{running ? ` · ${running}` : ""}
            </TabsTrigger>
            <TabsTrigger value="telemetry" className="font-mono text-[11px] tracking-widest uppercase">
              Deck
            </TabsTrigger>
          </TabsList>
          <TabsContent value="transcript" className="hud-notch hud-panel h-[38dvh] overflow-hidden">
            <Transcript
              messages={apex.messages}
              interim={mic.interim}
              thinking={apex.thinking}
            />
          </TabsContent>
          <TabsContent value="tasks" className="hud-notch hud-panel h-[38dvh] overflow-y-auto">
            <TaskBoard tasks={apex.tasks} />
          </TabsContent>
          <TabsContent value="telemetry" className="hud-notch hud-panel h-[38dvh] overflow-y-auto">
            <Telemetry
              capabilities={apex.capabilities}
              bootedAt={bootedAt}
              exchanges={exchanges}
              running={running}
              completed={completed}
              micOpen={handsFree && mic.listening}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Header({
  status,
  core,
  handsFree,
  voiceOut,
  bargeIn,
  micSupported,
  onToggleVoice,
  onToggleBargeIn,
  onClear,
}: {
  status: DeckStatus;
  core: string;
  handsFree: boolean;
  voiceOut: boolean;
  bargeIn: boolean;
  micSupported: boolean;
  onToggleVoice: () => void;
  onToggleBargeIn: () => void;
  onClear: () => void;
}) {
  return (
    <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-primary/15 px-4 py-2.5">
      <div className="flex items-baseline gap-3">
        <span className="hud-text-glow text-xl leading-none font-bold tracking-[0.3em] text-primary">
          APEX
        </span>
        <span className="hud-label hidden sm:inline">operations deck</span>
      </div>

      <div className="flex items-center gap-2">
        <StatusPill status={status} />
        <span className="hidden font-mono text-[10px] tracking-widest text-muted-foreground uppercase md:inline">
          {core === "gemini" ? "gemini" : "local core"}
        </span>

        <div className="mx-1 hidden h-5 w-px bg-primary/15 sm:block" />

        <IconToggle
          active={voiceOut}
          onClick={onToggleVoice}
          label={voiceOut ? "Mute APEX" : "Unmute APEX"}
        >
          {voiceOut ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </IconToggle>

        <IconToggle
          active={bargeIn}
          onClick={onToggleBargeIn}
          disabled={!micSupported || !handsFree}
          label={
            bargeIn
              ? "Barge-in on — use headphones"
              : "Barge-in off — mic closes while APEX speaks"
          }
        >
          <Headphones className="size-4" />
        </IconToggle>

        <IconToggle active={false} onClick={onClear} label="Clear the deck">
          <Trash2 className="size-4" />
        </IconToggle>
      </div>
    </header>
  );
}

function StatusPill({ status }: { status: DeckStatus }) {
  const map: Record<DeckStatus, { label: string; cls: string }> = {
    standby: { label: "Standby", cls: "text-muted-foreground border-muted-foreground/30" },
    listening: { label: "Listening", cls: "text-primary border-primary/50" },
    thinking: { label: "Reasoning", cls: "text-[color:var(--alert)] border-[color:var(--alert)]/50" },
    speaking: { label: "Speaking", cls: "text-primary border-primary/50" },
  };
  const s = map[status];
  return (
    <span
      className={cn(
        "hud-notch flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] tracking-widest uppercase",
        s.cls,
      )}
    >
      <Radio className={cn("size-3", status !== "standby" && "animate-pulse")} />
      {s.label}
    </span>
  );
}

function IconToggle({
  active,
  onClick,
  label,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "hud-notch size-8 text-muted-foreground hover:text-primary",
        active && "bg-primary/10 text-primary",
      )}
    >
      {children}
    </Button>
  );
}

function Notice({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div className="relative z-10 mx-3 mt-2 flex items-start gap-2 border border-[color:var(--alert)]/40 bg-[color:var(--alert)]/8 px-3 py-2">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[color:var(--alert)]" />
      <p className="flex-1 text-xs leading-relaxed text-[color:var(--alert)]">{text}</p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-[color:var(--alert)]/70 hover:text-[color:var(--alert)]"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function Panel({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("hud-notch hud-panel flex flex-col overflow-hidden", className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-primary/12 px-4 py-2">
        <span className="hud-label">{title}</span>
        {hint && (
          <span className="font-mono text-[10px] tracking-widest text-primary/60 uppercase">
            {hint}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

function Backdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,color-mix(in_oklch,var(--primary)_11%,transparent),transparent_62%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px animate-hud-sweep bg-gradient-to-r from-transparent via-primary/60 to-transparent"
      />
    </>
  );
}
