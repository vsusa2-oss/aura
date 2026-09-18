"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { audioBus } from "@/lib/apex/audio-bus";
import { useLatest } from "./use-latest";

export type VoicePath = "elevenlabs" | "browser" | "muted";

export interface VoiceHandle {
  speaking: boolean;
  path: VoicePath;
  speak: (text: string) => void;
  cancel: () => void;
}

interface Options {
  enabled: boolean;
  onSpeakingChange?: (speaking: boolean) => void;
}

/**
 * Serialised speech output. Every utterance goes through one queue so a task debrief
 * landing mid-conversation waits its turn instead of talking over the reply.
 *
 * ElevenLabs is used when the server has a key; a 204 means "no key, use the browser".
 */
export function useVoice({ enabled, onSpeakingChange }: Options): VoiceHandle {
  const [speaking, setSpeaking] = useState(false);
  const [resolvedPath, setResolvedPath] = useState<Exclude<VoicePath, "muted">>("browser");

  const queue = useRef<string[]>([]);
  const draining = useRef(false);
  const cancelled = useRef(false);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useLatest(enabled);
  const onChange = useLatest(onSpeakingChange);

  useEffect(() => {
    const el = new Audio();
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    audioEl.current = el;
    return () => {
      el.pause();
      el.src = "";
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/capabilities")
      .then((r) => r.json())
      .then((caps) => {
        if (alive) {
          setResolvedPath(caps?.voice?.core === "elevenlabs" ? "elevenlabs" : "browser");
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const setSpeakingState = useCallback(
    (next: boolean) => {
      setSpeaking(next);
      onChange.current?.(next);
    },
    [onChange],
  );

  const drain = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    while (queue.current.length) {
      const text = queue.current.shift()!;
      if (cancelled.current || !enabledRef.current) continue;
      setSpeakingState(true);
      try {
        const played = await speakViaElevenLabs(text, audioEl.current);
        if (!played && !cancelled.current) await speakViaBrowser(text);
      } catch {
        /* a dropped utterance should never wedge the queue */
      }
      setSpeakingState(false);
    }
    audioBus().setSynthetic(false);
    draining.current = false;
    cancelled.current = false;
  }, [setSpeakingState, enabledRef]);

  const speak = useCallback(
    (text: string) => {
      const clean = text.replace(/\s+/g, " ").trim();
      if (!clean || !enabledRef.current) return;
      cancelled.current = false;
      queue.current.push(clean);
      void drain();
    },
    [drain, enabledRef],
  );

  /** Stop the hardware. Deliberately free of React state so effects can call it. */
  const silence = useCallback(() => {
    cancelled.current = true;
    queue.current = [];
    if (audioEl.current) {
      audioEl.current.pause();
      audioEl.current.currentTime = 0;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    audioBus().setSynthetic(false);
  }, []);

  const cancel = useCallback(() => {
    silence();
    setSpeakingState(false);
  }, [silence, setSpeakingState]);

  useEffect(() => {
    if (!enabled) silence();
  }, [enabled, silence]);

  return {
    // Muting is instant from the operator's point of view, even if a fetch is still in
    // flight behind it, so the reported state follows `enabled` directly.
    speaking: enabled && speaking,
    path: enabled ? resolvedPath : "muted",
    speak,
    cancel,
  };
}

async function speakViaElevenLabs(
  text: string,
  el: HTMLAudioElement | null,
): Promise<boolean> {
  if (!el) return false;
  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).catch(() => null);

  if (!res || res.status === 204 || !res.ok) return false;

  const blob = await res.blob();
  if (!blob.size) return false;
  const url = URL.createObjectURL(blob);

  audioBus().attachOutput(el);
  await audioBus().resume();

  try {
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        el.removeEventListener("ended", done);
        el.removeEventListener("error", fail);
        resolve();
      };
      const fail = () => {
        el.removeEventListener("ended", done);
        el.removeEventListener("error", fail);
        reject(new Error("playback failed"));
      };
      el.addEventListener("ended", done);
      el.addEventListener("error", fail);
      el.src = url;
      el.play().catch(fail);
    });
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function speakViaBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) {
      // No synthesis engine (some headless and Linux builds). Hold the "speaking" state
      // for a readable beat so the HUD still animates the reply.
      audioBus().setSynthetic(true);
      setTimeout(() => {
        audioBus().setSynthetic(false);
        resolve();
      }, Math.min(9000, 400 + text.length * 42));
      return;
    }

    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(synth);
    if (voice) utter.voice = voice;
    utter.rate = 1.03;
    utter.pitch = 0.92;
    utter.volume = 1;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      audioBus().setSynthetic(false);
      resolve();
    };

    // Some platforms never fire `end`; cap on a generous reading-time estimate.
    const watchdog = setTimeout(finish, Math.min(45000, 2500 + text.length * 85));

    utter.onstart = () => audioBus().setSynthetic(true);
    utter.onend = finish;
    utter.onerror = finish;

    try {
      synth.cancel();
      synth.speak(utter);
      audioBus().setSynthetic(true);
    } catch {
      finish();
    }
  });
}

const VOICE_PREFERENCE = [
  /google uk english male/i,
  /google us english/i,
  /daniel/i,
  /microsoft (guy|ryan|david)/i,
  /alex/i,
  /en-gb/i,
  /en-us/i,
];

function pickVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (!voices.length) return null;
  for (const pattern of VOICE_PREFERENCE) {
    const hit = voices.find((v) => pattern.test(v.name) || pattern.test(v.lang));
    if (hit) return hit;
  }
  return voices.find((v) => v.lang.startsWith("en")) ?? voices[0];
}
