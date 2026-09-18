"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLatest } from "./use-latest";
import { GREETING } from "@/lib/apex/persona";
import type {
  Capabilities,
  ChatRequest,
  CoreId,
  Directive,
  Message,
  Task,
} from "@/lib/apex/types";

export type DeckStatus = "standby" | "listening" | "thinking" | "speaking";

interface Options {
  speak: (text: string) => void;
  cancelSpeech: () => void;
}

const TICK_MS = 120;

export function useApex({ speak, cancelSpeech }: Options) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [thinking, setThinking] = useState(false);
  const [core, setCore] = useState<CoreId>("local");
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const abort = useRef<AbortController | null>(null);
  const tasksRef = useLatest(tasks);
  const messagesRef = useLatest(messages);
  const schedule = useRef(new Map<string, { durations: number[]; startedAt: number }>());
  const debriefed = useRef(new Set<string>());
  const exchange = useRef(0);

  useEffect(() => {
    fetch("/api/capabilities")
      .then((r) => r.json())
      .then((caps: Capabilities) => {
        setCapabilities(caps);
        setCore(caps.reasoning.core);
      })
      .catch(() => {});
  }, []);

  const push = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const greet = useCallback(() => {
    if (messagesRef.current.length) return;
    const m: Message = {
      id: id(),
      speaker: "apex",
      text: GREETING,
      at: Date.now(),
      status: "complete",
    };
    push(m);
    speak(GREETING);
  }, [push, speak, messagesRef]);

  const assign = useCallback((d: Extract<Directive, { kind: "assign" }>) => {
    const steps = d.steps.length ? d.steps : ["Working the assignment"];
    const now = Date.now();
    const task: Task = {
      id: id(),
      title: d.title,
      brief: d.brief,
      priority: d.priority,
      state: "running",
      steps: steps.map((label, i) => ({ label, state: i === 0 ? "active" : "pending" })),
      progress: 0,
      createdAt: now,
      log: [
        { at: now, line: `Accepted — ${d.title}` },
        { at: now, line: steps[0] },
      ],
    };
    // Phases get uneven weights so the bar doesn't march at a fake-looking constant rate.
    const durations = steps.map(() => 2600 + Math.random() * 4200);
    schedule.current.set(task.id, { durations, startedAt: now });
    setTasks((prev) => [task, ...prev]);
    return task;
  }, []);

  const cancel = useCallback((d: Extract<Directive, { kind: "cancel" }>) => {
    setTasks((prev) => {
      const live = prev.filter((t) => t.state === "running" || t.state === "queued");
      if (!live.length) return prev;

      const target =
        live.find((t) => t.id === d.taskId) ??
        (d.match ? live.find((t) => titleMatches(t.title, d.match!)) : undefined) ??
        (live.length === 1 ? live[0] : undefined);
      if (!target) return prev;

      schedule.current.delete(target.id);
      debriefed.current.add(target.id);
      return prev.map((t) =>
        t.id === target.id
          ? {
              ...t,
              state: "cancelled" as const,
              log: [...t.log, { at: Date.now(), line: "Cancelled by operator" }],
            }
          : t,
      );
    });
  }, []);

  /** Stream one reply. `mode` picks conversation vs. end-of-assignment debrief. */
  const runStream = useCallback(
    async (
      payload: ChatRequest,
      opts: { taskId?: string; signal?: AbortSignal } = {},
    ): Promise<string> => {
      const messageId = id();
      push({
        id: messageId,
        speaker: "apex",
        text: "",
        at: Date.now(),
        status: "streaming",
        taskId: opts.taskId,
      });

      const spokenUpTo = { index: 0 };
      let full = "";

      const flushSpeech = (force: boolean) => {
        const pendingText = full.slice(spokenUpTo.index);
        const boundary = force
          ? pendingText.length
          : lastSentenceBoundary(pendingText, 90);
        if (boundary <= 0) return;
        const chunk = pendingText.slice(0, boundary).trim();
        spokenUpTo.index += boundary;
        if (chunk) speak(chunk);
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: opts.signal,
        });
        if (!res.ok || !res.body) throw new Error(`core returned ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let event: Record<string, unknown>;
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }

            if (event.type === "meta") {
              setCore(event.core as CoreId);
            } else if (event.type === "text") {
              full += event.value as string;
              const snapshot = full;
              setMessages((prev) =>
                prev.map((m) => (m.id === messageId ? { ...m, text: snapshot } : m)),
              );
              flushSpeech(false);
            } else if (event.type === "directive") {
              const d = event.value as Directive;
              if (d.kind === "assign") assign(d);
              else if (d.kind === "cancel") cancel(d);
            } else if (event.type === "notice") {
              setNotice(event.value as string);
            }
          }
        }

        flushSpeech(true);
        const finalText = full.trim();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  text: finalText || "(no response)",
                  status: finalText ? "complete" : "error",
                }
              : m,
          ),
        );
        return finalText;
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, text: full.trim() || "(interrupted)", status: "complete" }
                : m,
            ),
          );
          return "";
        }
        const detail = err instanceof Error ? err.message : "unknown fault";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, text: `Link to the core dropped — ${detail}.`, status: "error" }
              : m,
          ),
        );
        return "";
      }
    },
    [assign, cancel, push, speak],
  );

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;

      // A new utterance always wins: drop whatever APEX was mid-way through saying.
      const turn = ++exchange.current;
      cancelSpeech();
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;

      const operatorMessage: Message = {
        id: id(),
        speaker: "operator",
        text: clean,
        at: Date.now(),
        status: "complete",
      };
      setMessages((prev) => [...prev, operatorMessage]);
      setThinking(true);
      setNotice(null);

      const turns = [...messagesRef.current, operatorMessage]
        .filter((m) => m.speaker !== "system" && m.text.trim())
        .map((m) => ({
          role: m.speaker === "operator" ? ("operator" as const) : ("apex" as const),
          text: m.text,
        }));

      await runStream(
        { turns, tasks: boardSnapshot(tasksRef.current), mode: "converse" },
        { signal: controller.signal },
      );
      if (exchange.current === turn) setThinking(false);
    },
    [cancelSpeech, runStream, messagesRef, tasksRef],
  );

  const debrief = useCallback(
    async (task: Task) => {
      const turns = messagesRef.current
        .filter((m) => m.speaker !== "system" && m.text.trim())
        .slice(-12)
        .map((m) => ({
          role: m.speaker === "operator" ? ("operator" as const) : ("apex" as const),
          text: m.text,
        }));

      const report = await runStream(
        {
          turns,
          tasks: boardSnapshot(tasksRef.current),
          mode: "debrief",
          debriefTask: { title: task.title, brief: task.brief, steps: task.steps },
        },
        { taskId: task.id },
      );

      if (!report) return;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, report, log: [...t.log, { at: Date.now(), line: "Report filed" }] }
            : t,
        ),
      );
    },
    [runStream, messagesRef, tasksRef],
  );

  // Assignment engine: advances every running task and fires a debrief when one lands.
  useEffect(() => {
    const timer = setInterval(() => {
      const finished: Task[] = [];

      setTasks((prev) => {
        let changed = false;
        const next = prev.map((task) => {
          if (task.state !== "running") return task;
          const plan = schedule.current.get(task.id);
          if (!plan) return task;

          const total = plan.durations.reduce((a, b) => a + b, 0);
          const elapsed = Date.now() - plan.startedAt;
          const progress = Math.min(100, (elapsed / total) * 100);

          let cursor = 0;
          let active = plan.durations.length;
          for (let i = 0; i < plan.durations.length; i++) {
            cursor += plan.durations[i];
            if (elapsed < cursor) {
              active = i;
              break;
            }
          }

          const steps = task.steps.map((s, i) => ({
            ...s,
            state:
              i < active ? ("done" as const) : i === active ? ("active" as const) : ("pending" as const),
          }));

          if (elapsed >= total) {
            changed = true;
            const done: Task = {
              ...task,
              state: "complete",
              progress: 100,
              completedAt: Date.now(),
              steps: task.steps.map((s) => ({ ...s, state: "done" as const })),
              log: [
                ...task.log,
                { at: Date.now(), line: "All phases closed — compiling debrief" },
              ],
            };
            finished.push(done);
            return done;
          }

          if (stepsDiffer(task.steps, steps)) {
            changed = true;
            const entered = steps[active];
            return {
              ...task,
              progress,
              steps,
              log: entered ? [...task.log, { at: Date.now(), line: entered.label }] : task.log,
            };
          }

          if (Math.abs(progress - task.progress) > 0.4) {
            changed = true;
            return { ...task, progress };
          }
          return task;
        });
        return changed ? next : prev;
      });

      for (const task of finished) {
        if (debriefed.current.has(task.id)) continue;
        debriefed.current.add(task.id);
        schedule.current.delete(task.id);
        void debrief(task);
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [debrief]);

  const clear = useCallback(() => {
    abort.current?.abort();
    cancelSpeech();
    setMessages([]);
    setTasks([]);
    setNotice(null);
    schedule.current.clear();
    debriefed.current.clear();
  }, [cancelSpeech]);

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.state === "running" || t.state === "queued"),
    [tasks],
  );

  return {
    messages,
    tasks,
    activeTasks,
    thinking,
    core,
    capabilities,
    notice,
    send,
    greet,
    clear,
    dismissNotice: () => setNotice(null),
  };
}

function boardSnapshot(tasks: Task[]) {
  return tasks.slice(0, 12).map((t) => ({
    id: t.id,
    title: t.title,
    state: t.state,
    progress: t.progress,
  }));
}

function stepsDiffer(a: Task["steps"], b: Task["steps"]) {
  return a.some((s, i) => s.state !== b[i]?.state);
}

/** The model usually names an assignment rather than quoting its id back at us. */
function titleMatches(title: string, match: string): boolean {
  const words = match
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
  if (!words.length) return false;
  const lower = title.toLowerCase();
  return words.some((w) => lower.includes(w));
}

/** Speak in whole sentences so playback can start before the reply finishes streaming. */
function lastSentenceBoundary(text: string, minLength: number): number {
  if (text.length < minLength) return 0;
  const match = text.match(/^[\s\S]*[.!?](?=\s|$)/);
  if (!match) return 0;
  const end = match[0].length;
  return end >= minLength ? end : 0;
}

function id(): string {
  return Math.random().toString(36).slice(2, 10);
}
