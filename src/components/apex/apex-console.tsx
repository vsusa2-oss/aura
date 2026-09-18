"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BootSequence } from "@/components/apex/boot-sequence";
import { CoreOrb } from "@/components/apex/core-orb";
import { HudPanel } from "@/components/apex/hud-panel";
import { MissionBoard } from "@/components/apex/mission-board";
import { StatusRail } from "@/components/apex/status-rail";
import { TranscriptPanel } from "@/components/apex/transcript-panel";
import { VoiceBar } from "@/components/apex/voice-bar";
import { useMissions } from "@/hooks/use-missions";
import { useSpeech } from "@/hooks/use-speech";
import type { ApexTurn, EngineKind, LinkState, Mission, TranscriptEntry } from "@/lib/types";
import { uid } from "@/lib/utils";

const GREETING =
  "Apex online. Link is open. Assign work, or just talk — I'll keep the channel and report back when a mission lands.";

export function ApexConsole() {
  const [booted, setBooted] = useState(false);
  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [state, setState] = useState<LinkState>("boot");
  const [engine, setEngine] = useState<EngineKind>("local");
  const [voice, setVoice] = useState<"elevenlabs" | "browser">("browser");
  const [clock, setClock] = useState("--:--:--");
  const [linkOpen, setLinkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(0.18);

  const busyRef = useRef(false);
  const linkOpenRef = useRef(false);
  const entriesRef = useRef(entries);
  const {
    listening,
    interim,
    sttSupported,
    micError,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    setOnFinal,
  } = useSpeech();
  const missionsRef = useRef<Mission[]>([]);
  const completeRef = useRef<(id: string, report: string) => void>(() => {});
  const startListenRef = useRef(startListening);
  const stopListenRef = useRef(stopListening);
  const speakRef = useRef(speak);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    linkOpenRef.current = linkOpen;
  }, [linkOpen]);

  useEffect(() => {
    startListenRef.current = startListening;
    stopListenRef.current = stopListening;
    speakRef.current = speak;
  }, [startListening, stopListening, speak]);

  const push = useCallback((role: TranscriptEntry["role"], text: string) => {
    setEntries((prev) => [
      ...prev,
      { id: uid("tx"), role, text, at: Date.now() },
    ]);
  }, []);

  const resumeListen = useCallback(() => {
    if (linkOpenRef.current) {
      setState("listening");
      startListenRef.current();
    } else {
      setState("standby");
    }
  }, []);

  const handleReport = useCallback(
    async (mission: Mission) => {
      setState("reporting");
      stopListenRef.current();
      try {
        const context = entriesRef.current
          .slice(-10)
          .map((e) => `${e.role}: ${e.text}`)
          .join("\n");
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: mission.title,
            brief: mission.brief,
            context,
          }),
        });
        const data = (await res.json()) as { report?: string };
        const report =
          data.report ||
          `Mission complete: ${mission.title}. Notes are on the board.`;
        completeRef.current(mission.id, report);
        push("system", report);
        await speakRef.current(report, {
          onStart: () => setState("reporting"),
          onEnd: resumeListen,
        });
      } catch {
        const fallback = `Mission complete: ${mission.title}. Brief is on the board.`;
        completeRef.current(mission.id, fallback);
        push("system", fallback);
        await speakRef.current(fallback, { onEnd: resumeListen });
      }
    },
    [push, resumeListen],
  );

  const { missions, applyActions, completeWithReport } = useMissions(handleReport);

  useEffect(() => {
    missionsRef.current = missions;
  }, [missions]);

  useEffect(() => {
    completeRef.current = completeWithReport;
  }, [completeWithReport]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setDraft("");
      push("operator", text);
      setState("thinking");
      stopListenRef.current();

      try {
        const history = [
          ...entriesRef.current
            .filter((e) => e.role !== "system")
            .slice(-16)
            .map((e) => ({
              role: e.role === "operator" ? ("user" as const) : ("assistant" as const),
              content: e.text,
            })),
          { role: "user" as const, content: text },
        ];
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            missions: missionsRef.current.map((m) => ({
              id: m.id,
              title: m.title,
              status: m.status,
              progress: m.progress,
            })),
          }),
        });
        if (!res.ok) throw new Error("chat failed");
        const turn = (await res.json()) as ApexTurn;
        setEngine(turn.engine);
        applyActions(turn.missions || []);
        push("apex", turn.speech);
        await speakRef.current(turn.speech, {
          onStart: () => setState("speaking"),
          onEnd: resumeListen,
        });
      } catch {
        const fail =
          "Link dropped on that last transmission. Try again — I'm still here.";
        push("apex", fail);
        await speakRef.current(fail, { onEnd: resumeListen });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [applyActions, push, resumeListen],
  );

  useEffect(() => {
    setOnFinal((text) => {
      void send(text);
    });
  }, [send, setOnFinal]);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: { engine?: EngineKind; voice?: "elevenlabs" | "browser" }) => {
        if (s.engine) setEngine(s.engine);
        if (s.voice) setVoice(s.voice);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().slice(11, 19));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLevel(
        state === "listening" || state === "speaking" || state === "reporting"
          ? 0.35 + Math.random() * 0.65
          : 0.12 + Math.random() * 0.12,
      );
    }, 140);
    return () => window.clearInterval(id);
  }, [state]);

  const finishBoot = useCallback(() => {
    setBooted(true);
    setState("speaking");
    push("apex", GREETING);
    void speakRef.current(GREETING, {
      onEnd: () => setState("standby"),
    });
  }, [push]);

  const toggleLink = () => {
    if (linkOpen) {
      setLinkOpen(false);
      linkOpenRef.current = false;
      stopListening();
      cancelSpeech();
      setState("standby");
    } else {
      setLinkOpen(true);
      linkOpenRef.current = true;
      setState("listening");
      startListening();
    }
  };

  const liveMissions = useMemo(
    () => missions.filter((m) => m.status !== "cancelled").length,
    [missions],
  );

  return (
    <div className="hud-shell relative flex min-h-dvh flex-col overflow-hidden">
      <div className="hex-grid" />
      <div className="vignette" />
      <div className="scanlines" />
      {!booted ? <BootSequence onDone={finishBoot} /> : null}

      <div className="relative z-10 flex min-h-dvh flex-col gap-3 p-3 sm:p-5">
        <StatusRail state={state} engine={engine} voice={voice} clock={clock} />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
          <HudPanel
            title="CHANNEL"
            meta={`${entries.length} FRAMES`}
            className="h-[38vh] lg:h-auto"
          >
            <TranscriptPanel entries={entries} interim={interim} />
          </HudPanel>

          <div className="relative flex min-h-[320px] flex-col items-center justify-center">
            <CoreOrb state={state} level={level} />
            <p className="mt-2 max-w-sm text-center font-[family-name:var(--font-ui)] text-sm text-cyan-100/70">
              Digital officer on the line. Speak naturally. Assign work. Apex comes back with the brief.
            </p>
          </div>

          <HudPanel
            title="MISSIONS"
            meta={`${liveMissions} LIVE`}
            className="h-[42vh] lg:h-auto"
          >
            <MissionBoard missions={missions} />
          </HudPanel>
        </div>

        <VoiceBar
          value={draft}
          onChange={setDraft}
          onSubmit={() => void send(draft)}
          listening={listening}
          linkOpen={linkOpen}
          onToggleLink={toggleLink}
          disabled={busy || !booted}
          micError={micError}
          sttSupported={sttSupported}
        />
      </div>
    </div>
  );
}
