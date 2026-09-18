"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLatest } from "./use-latest";

interface Options {
  /** Fires once the operator has stopped talking for `settleMs`. */
  onUtterance: (text: string) => void;
  lang?: string;
  settleMs?: number;
}

export interface SpeechRecognitionHandle {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}

/**
 * Continuous dictation with end-of-utterance detection.
 *
 * Chrome ends a recognition session on its own schedule, so `wanted` tracks whether we
 * still want the mic open and restarts it whenever the engine drops out from under us.
 */
export function useSpeechRecognition({
  onUtterance,
  lang = "en-US",
  settleMs = 1100,
}: Options): SpeechRecognitionHandle {
  const supported = useSyncExternalStore(subscribeNever, hasSpeechEngine, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognition = useRef<SpeechRecognition | null>(null);
  const wanted = useRef(false);
  const pending = useRef("");
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUtteranceRef = useLatest(onUtterance);

  const flush = useCallback(() => {
    const text = pending.current.trim();
    pending.current = "";
    setInterim("");
    if (text) onUtteranceRef.current(text);
  }, [onUtteranceRef]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListening(true);
      setError(null);
    };

    rec.onresult = (event) => {
      let live = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          pending.current = `${pending.current} ${text}`.trim();
        } else {
          live += text;
        }
      }
      setInterim(live);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      if (pending.current) {
        settleTimer.current = setTimeout(flush, settleMs);
      }
    };

    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      setError(
        event.error === "not-allowed"
          ? "Microphone blocked. Allow mic access to talk to APEX."
          : `Speech engine: ${event.error}`,
      );
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        wanted.current = false;
      }
    };

    rec.onend = () => {
      setListening(false);
      if (!wanted.current) return;
      if (restartTimer.current) clearTimeout(restartTimer.current);
      restartTimer.current = setTimeout(() => {
        if (!wanted.current) return;
        try {
          rec.start();
        } catch {
          /* already starting */
        }
      }, 220);
    };

    recognition.current = rec;
    return () => {
      wanted.current = false;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      if (restartTimer.current) clearTimeout(restartTimer.current);
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onstart = null;
      try {
        rec.abort();
      } catch {
        /* never started */
      }
      recognition.current = null;
    };
  }, [lang, settleMs, flush]);

  const start = useCallback(() => {
    if (!recognition.current) return;
    wanted.current = true;
    setError(null);
    try {
      recognition.current.start();
    } catch {
      /* already running */
    }
  }, []);

  const stop = useCallback(() => {
    wanted.current = false;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    pending.current = "";
    setInterim("");
    try {
      recognition.current?.stop();
    } catch {
      /* never started */
    }
    setListening(false);
  }, []);

  return { supported, listening, interim, error, start, stop };
}

/** Engine availability never changes for the life of the page. */
function subscribeNever() {
  return () => {};
}

function hasSpeechEngine() {
  return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}
