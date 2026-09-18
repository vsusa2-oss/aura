"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type SpeakOpts = {
  onStart?: () => void;
  onEnd?: () => void;
};

function pickVoice(voices: SpeechSynthesisVoice[]) {
  const ranked = [
    (v: SpeechSynthesisVoice) => /google uk english male/i.test(v.name),
    (v: SpeechSynthesisVoice) => /daniel/i.test(v.name) && /en/i.test(v.lang),
    (v: SpeechSynthesisVoice) => /uk english/i.test(v.name),
    (v: SpeechSynthesisVoice) => /en-GB/i.test(v.lang),
    (v: SpeechSynthesisVoice) => /en-US/i.test(v.lang) && /male/i.test(v.name),
    (v: SpeechSynthesisVoice) => /^en/i.test(v.lang),
  ];
  for (const test of ranked) {
    const hit = voices.find(test);
    if (hit) return hit;
  }
  return voices[0];
}

function subscribeNoop() {
  return () => {};
}

function getSttSupported() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function useSpeech() {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const sttSupported = useSyncExternalStore(subscribeNoop, getSttSupported, () => false);
  const [micError, setMicError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognition | null>(null);
  const wantListen = useRef(false);
  const flushTimer = useRef<number | null>(null);
  const bufferRef = useRef("");
  const onFinalRef = useRef<(text: string) => void>(() => {});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakingRef = useRef(false);

  useEffect(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => {
      setListening(true);
      setMicError(null);
    };

    rec.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      if (event.error === "not-allowed") {
        setMicError("Microphone blocked. Type instead, or allow mic access.");
        wantListen.current = false;
        setListening(false);
        return;
      }
      setMicError(event.error);
    };

    rec.onend = () => {
      setListening(false);
      if (wantListen.current && !speakingRef.current) {
        window.setTimeout(() => {
          if (!wantListen.current || speakingRef.current) return;
          try {
            rec.start();
          } catch {
            /* already started */
          }
        }, 180);
      }
    };

    rec.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          bufferRef.current = `${bufferRef.current} ${piece}`.trim();
        } else {
          interimText += piece;
        }
      }
      setInterim(interimText);
      if (flushTimer.current) window.clearTimeout(flushTimer.current);
      if (bufferRef.current) {
        flushTimer.current = window.setTimeout(() => {
          const text = bufferRef.current.trim();
          bufferRef.current = "";
          setInterim("");
          if (text) onFinalRef.current(text);
        }, 720);
      }
    };

    recRef.current = rec;
    return () => {
      wantListen.current = false;
      try {
        rec.abort();
      } catch {
        /* noop */
      }
    };
  }, []);

  const startListening = useCallback(() => {
    wantListen.current = true;
    setMicError(null);
    const rec = recRef.current;
    if (!rec) {
      setMicError("This browser has no speech recognition. Type to talk.");
      return;
    }
    try {
      rec.start();
    } catch {
      /* already running */
    }
  }, []);

  const stopListening = useCallback(() => {
    wantListen.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
    setInterim("");
  }, []);

  const cancelSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  const speakBrowser = useCallback((text: string, opts?: SpeakOpts) => {
    return new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const voice = pickVoice(voices);
      if (voice) utter.voice = voice;
      utter.rate = 1.02;
      utter.pitch = 0.92;
      utter.onstart = () => {
        speakingRef.current = true;
        setSpeaking(true);
        opts?.onStart?.();
      };
      const done = () => {
        speakingRef.current = false;
        setSpeaking(false);
        opts?.onEnd?.();
        resolve();
      };
      utter.onend = done;
      utter.onerror = done;
      window.speechSynthesis.speak(utter);
    });
  }, []);

  const speak = useCallback(
    async (text: string, opts?: SpeakOpts) => {
      cancelSpeech();
      stopListening();
      speakingRef.current = true;
      setSpeaking(true);
      opts?.onStart?.();

      try {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.status === 200 && res.headers.get("content-type")?.includes("audio")) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          await new Promise<void>((resolve) => {
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.play().catch(() => resolve());
          });
          speakingRef.current = false;
          setSpeaking(false);
          opts?.onEnd?.();
          return;
        }
      } catch {
        /* fall through */
      }

      if (!window.speechSynthesis) {
        speakingRef.current = false;
        setSpeaking(false);
        opts?.onEnd?.();
        return;
      }

      if (window.speechSynthesis.getVoices().length === 0) {
        await new Promise<void>((resolve) => {
          window.speechSynthesis.addEventListener("voiceschanged", () => resolve(), {
            once: true,
          });
          window.setTimeout(() => resolve(), 400);
        });
      }
      const safety = window.setTimeout(() => {
        if (!speakingRef.current) return;
        speakingRef.current = false;
        setSpeaking(false);
        opts?.onEnd?.();
      }, Math.min(20000, 2500 + text.length * 55));
      await speakBrowser(text, { onStart: undefined, onEnd: undefined });
      const stillSpeaking = speakingRef.current;
      window.clearTimeout(safety);
      speakingRef.current = false;
      setSpeaking(false);
      if (stillSpeaking) opts?.onEnd?.();
    },
    [cancelSpeech, speakBrowser, stopListening],
  );

  const setOnFinal = useCallback((fn: (text: string) => void) => {
    onFinalRef.current = fn;
  }, []);

  return {
    listening,
    speaking,
    interim,
    sttSupported,
    micError,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    setOnFinal,
  };
}
