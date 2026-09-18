"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getRecognition(): SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function useVoice(options: {
  onTranscript: (text: string) => void;
  onSpeakingChange?: (speaking: boolean) => void;
}) {
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<"browser" | "elevenlabs">(
    "browser",
  );
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const onTranscriptRef = useRef(options.onTranscript);
  const onSpeakingRef = useRef(options.onSpeakingChange);
  onTranscriptRef.current = options.onTranscript;
  onSpeakingRef.current = options.onSpeakingChange;

  useEffect(() => {
    const rec = getRecognition();
    recognitionRef.current = rec;
    setSpeechSupported(!!rec);
    if (!rec) return;

    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        }
      }
      if (final.trim()) {
        onTranscriptRef.current(final.trim());
      }
    };

    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();
    }
    onSpeakingRef.current?.(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      stopSpeaking();
      onSpeakingRef.current?.(true);

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (res.headers.get("Content-Type")?.includes("audio/mpeg")) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          setTtsProvider("elevenlabs");
          audio.onended = () => {
            URL.revokeObjectURL(url);
            onSpeakingRef.current?.(false);
          };
          await audio.play();
          return;
        }

        setTtsProvider("browser");
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.02;
        utter.pitch = 0.92;
        const voices = window.speechSynthesis.getVoices();
        const preferred =
          voices.find((v) => /google uk english male|daniel|alex/i.test(v.name)) ||
          voices.find((v) => v.lang.startsWith("en")) ||
          voices[0];
        if (preferred) utter.voice = preferred;
        utter.onend = () => onSpeakingRef.current?.(false);
        window.speechSynthesis.speak(utter);
      } catch {
        onSpeakingRef.current?.(false);
      }
    },
    [stopSpeaking],
  );

  const startListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || listening) return;
    stopSpeaking();
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening, stopSpeaking]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return {
    listening,
    speechSupported,
    ttsProvider,
    speak,
    startListening,
    stopListening,
    stopSpeaking,
  };
}
