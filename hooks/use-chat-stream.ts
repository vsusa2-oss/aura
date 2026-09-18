"use client";

import { useCallback, useRef, useState } from "react";
import type { ChatMessage, StreamEvent, Task } from "@/lib/types";

type LineMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

export function useChatStream(sessionId: string) {
  const [lines, setLines] = useState<LineMessage[]>([
    {
      id: "boot",
      role: "assistant",
      content:
        "APEX core initialized. Operator channel open — voice or text input accepted.",
    },
  ]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState(false);
  const historyRef = useRef<ChatMessage[]>([]);

  const refreshTasks = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(`/api/tasks?sessionId=${encodeURIComponent(sessionId)}`);
    if (res.ok) {
      const data = (await res.json()) as { tasks: Task[] };
      setTasks(data.tasks);
    }
  }, [sessionId]);

  const send = useCallback(
    async (content: string) => {
      if (!sessionId || !content.trim() || busy) return null;

      const userMsg: ChatMessage = { role: "user", content: content.trim() };
      historyRef.current = [...historyRef.current, userMsg];

      const userLineId = `u_${Date.now()}`;
      const assistantLineId = `a_${Date.now()}`;

      setLines((prev) => [
        ...prev,
        { id: userLineId, role: "user", content: userMsg.content },
        { id: assistantLineId, role: "assistant", content: "", streaming: true },
      ]);
      setBusy(true);

      let assistantText = "";

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            messages: historyRef.current,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error("Chat request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6);
            let event: StreamEvent;
            try {
              event = JSON.parse(json) as StreamEvent;
            } catch {
              continue;
            }

            if (event.type === "delta") {
              assistantText += event.text;
              setLines((prev) =>
                prev.map((l) =>
                  l.id === assistantLineId
                    ? { ...l, content: assistantText }
                    : l,
                ),
              );
            } else if (event.type === "task") {
              setTasks((prev) => {
                const idx = prev.findIndex((t) => t.id === event.task.id);
                if (idx === -1) return [...prev, event.task];
                const next = [...prev];
                next[idx] = event.task;
                return next;
              });
            } else if (event.type === "done") {
              assistantText = event.assistantMessage || assistantText;
            } else if (event.type === "error") {
              assistantText = `Channel fault: ${event.message}`;
            }
          }
        }

        historyRef.current = [
          ...historyRef.current,
          { role: "assistant", content: assistantText },
        ];

        setLines((prev) =>
          prev.map((l) =>
            l.id === assistantLineId
              ? { ...l, content: assistantText, streaming: false }
              : l,
          ),
        );

        await refreshTasks();
        return assistantText;
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Unknown error";
        setLines((prev) =>
          prev.map((l) =>
            l.id === assistantLineId
              ? {
                  ...l,
                  content: `Link degraded. ${msg}`,
                  streaming: false,
                }
              : l,
          ),
        );
        return null;
      } finally {
        setBusy(false);
      }
    },
    [sessionId, busy, refreshTasks],
  );

  return { lines, tasks, busy, send, refreshTasks, setTasks };
}
