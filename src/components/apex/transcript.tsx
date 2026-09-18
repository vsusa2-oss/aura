"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/apex/types";

interface Props {
  messages: Message[];
  interim: string;
  thinking: boolean;
}

export function Transcript({ messages, interim, thinking }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (pinned.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, interim, thinking]);

  return (
    <div
      ref={scrollRef}
      className="h-full space-y-4 overflow-y-auto px-4 py-4 sm:px-5"
      role="log"
      aria-live="polite"
      aria-label="Conversation transcript"
    >
      {messages.length === 0 && !interim && <EmptyState />}

      {messages.map((message) => (
        <Line key={message.id} message={message} />
      ))}

      {interim && (
        <div className="animate-hud-rise">
          <Meta speaker="operator" label="Operator" muted />
          <p className="pl-4 text-sm leading-relaxed text-muted-foreground italic">
            {interim}
            <span className="animate-hud-caret ml-0.5 inline-block">▌</span>
          </p>
        </div>
      )}

      {thinking && !messages.some((m) => m.status === "streaming") && (
        <div className="flex items-center gap-2 pl-4">
          <Dots />
          <span className="hud-label">processing</span>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}

function Line({ message }: { message: Message }) {
  const isOperator = message.speaker === "operator";
  return (
    <div className="animate-hud-rise">
      <Meta
        speaker={message.speaker}
        label={isOperator ? "Operator" : message.taskId ? "APEX · debrief" : "APEX"}
        at={message.at}
      />
      <p
        className={cn(
          "border-l-2 pl-4 text-[15px] leading-relaxed",
          isOperator
            ? "border-muted-foreground/25 text-foreground/85"
            : "border-primary/50 text-foreground",
          message.status === "error" && "border-destructive/60 text-destructive",
          message.taskId && "border-[color:var(--alert)]/60",
        )}
      >
        {message.text || <span className="text-muted-foreground">…</span>}
        {message.status === "streaming" && (
          <span className="animate-hud-caret ml-0.5 inline-block text-primary">▌</span>
        )}
      </p>
    </div>
  );
}

function Meta({
  speaker,
  label,
  at,
  muted,
}: {
  speaker: Message["speaker"];
  label: string;
  at?: number;
  muted?: boolean;
}) {
  return (
    <div className="mb-1 flex items-baseline gap-2 pl-4">
      <span
        className={cn(
          "hud-label",
          speaker === "apex" && !muted && "text-primary/80",
          muted && "opacity-60",
        )}
      >
        {label}
      </span>
      {at && (
        <span className="font-mono text-[10px] text-muted-foreground/50">
          {new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      )}
    </div>
  );
}

function Dots() {
  return (
    <span className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-bounce rounded-full bg-primary/70"
          style={{ animationDelay: `${i * 140}ms`, animationDuration: "900ms" }}
        />
      ))}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-40 flex-col justify-center gap-3 px-1 py-6">
      <p className="hud-label">No exchange logged</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        Hold the mic open and just talk, or type below. Anything that sounds like a job
        rather than a question gets picked up as an assignment and worked in the background.
      </p>
      <ul className="space-y-1.5 font-mono text-xs text-muted-foreground/70">
        <li>&gt; &ldquo;Apex, look into why our signup funnel dropped last week.&rdquo;</li>
        <li>&gt; &ldquo;Draft the release note for version two point one.&rdquo;</li>
        <li>&gt; &ldquo;Where are we at?&rdquo;</li>
      </ul>
    </div>
  );
}
