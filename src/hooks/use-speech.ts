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

  const speakBrowser = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (!window.speechSynthesis || window.speechSynthesis.getVoices().length === 0) {
        resolve();
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      const voice = pickVoice(window.speechSynthesis.getVoices());
      if (voice) utter.voice = voice;
      utter.rate = 1.02;
      utter.pitch = 0.92;
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(limit);
        resolve();
      };
      const limit = window.setTimeout(done, 8000);
      utter.onend = done;
      utter.onerror = done;
      try {
        window.speechSynthesis.speak(utter);
      } catch {
        done();
      }
    });
  }, []);

  const speak = useCallback(
    async (text: string, opts?: SpeakOpts) => {
      cancelSpeech();
      stopListening();
      speakingRef.current = true;
      setSpeaking(true);
      opts?.onStart?.();

      let ended = false;
      const finish = () => {
        if (ended) return;
        ended = true;
        speakingRef.current = false;
        setSpeaking(false);
        opts?.onEnd?.();
      };
      const safety = window.setTimeout(finish, Math.min(12000, 2000 + text.length * 40));

      try {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: AbortSignal.timeout(3500),
        });
        if (res.status === 200 && res.headers.get("content-type")?.includes("audio")) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          await new Promise<void>((resolve) => {
            const audio = new Audio(url);
            audioRef.current = audio;
            const stop = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onended = stop;
            audio.onerror = stop;
            window.setTimeout(stop, 12000);
            audio.play().catch(stop);
          });
          window.clearTimeout(safety);
          finish();
          return;
        }
      } catch {
        /* fall through to browser voice */
      }

      if (!window.speechSynthesis || window.speechSynthesis.getVoices().length === 0) {
        window.clearTimeout(safety);
        finish();
        return;
      }

      await speakBrowser(text);
      window.clearTimeout(safety);
      finish();
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
