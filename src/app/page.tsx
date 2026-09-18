"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AudioWaveform, Bot, Check, ChevronRight, CircleDot, Command,
  Cpu, Mic, MicOff, Pause, Play, Radio, Send, ShieldCheck, Sparkles,
  Terminal, Volume2, VolumeX, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Message = { role: "user" | "assistant"; content: string; time: string };
type Mission = {
  id: number;
  title: string;
  detail: string;
  status: "complete" | "active" | "queued";
  progress: number;
};
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

const initialMessages: Message[] = [{
  role: "assistant",
  content: "Good evening, Vivek. APEX is online. I’m monitoring your active workstream and ready for a new directive.",
  time: "22:02",
}];

const initialMissions: Mission[] = [
  { id: 1, title: "Synthesize market brief", detail: "12 sources analyzed", status: "complete", progress: 100 },
  { id: 2, title: "Review product signals", detail: "Scanning customer feedback", status: "active", progress: 68 },
  { id: 3, title: "Prepare morning dossier", detail: "Scheduled for 07:00", status: "queued", progress: 0 },
];

const now = () => new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date());

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [missions, setMissions] = useState<Mission[]>(initialMissions);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const continuousRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { continuousRef.current = continuous; }, [continuous]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const speak = useCallback((text: string) => {
    if (!soundOn || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02;
    utterance.pitch = 0.88;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => {
      setSpeaking(false);
      if (continuousRef.current) window.setTimeout(() => recognitionRef.current?.start(), 350);
    };
    window.speechSynthesis.speak(utterance);
  }, [soundOn]);

  const sendMessage = useCallback(async (raw: string) => {
    const content = raw.trim();
    if (!content || thinking) return;
    const userMessage: Message = { role: "user", content, time: now() };
    const requestHistory = [...messages, userMessage];
    const missionId = Date.now();
    setMessages(requestHistory);
    setInput("");
    setThinking(true);
    setMissions((current) => [{
      id: missionId,
      title: content.length > 38 ? `${content.slice(0, 38)}…` : content,
      detail: "APEX is processing",
      status: "active",
      progress: 24,
    }, ...current.slice(0, 3)]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: requestHistory }),
      });
      if (!response.ok) throw new Error("Assistant link unavailable");
      const data = (await response.json()) as { message: string; mode?: string };
      setMessages((current) => [...current, {
        role: "assistant", content: data.message, time: now(),
      }]);
      setMissions((current) => current.map((mission) => mission.id === missionId ? {
        ...mission,
        detail: data.mode === "live" ? "Completed with live intelligence" : "Completed in local demo mode",
        status: "complete",
        progress: 100,
      } : mission));
      speak(data.message);
    } catch {
      setNotice("Neural link interrupted. Check the connection and try again.");
      setMissions((current) => current.map((mission) => mission.id === missionId ? {
        ...mission, detail: "Connection interrupted", status: "queued",
      } : mission));
    } finally {
      setThinking(false);
    }
  }, [messages, speak, thinking]);

  const startListening = useCallback(() => {
    const browser = window as typeof window & {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const SpeechRecognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotice("Voice recognition is not available in this browser. Try Chrome.");
      return;
    }
    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setListening(false);
        void sendMessage(transcript);
      };
      recognition.onend = () => setListening(false);
      recognition.onerror = () => {
        setListening(false);
        setNotice("I couldn’t access the microphone. Check browser permissions.");
      };
      recognitionRef.current = recognition;
    }
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setNotice(null);
    setListening(true);
    try { recognitionRef.current.start(); } catch { setListening(false); }
  }, [sendMessage]);

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Command size={18} /></div>
          <div><div className="brand-name">APEX</div><div className="eyebrow">Adaptive Personal Executive</div></div>
        </div>
        <div className="system-pill"><span className="live-dot" /> SYSTEM ONLINE</div>
        <div className="top-actions">
          <button className="icon-button" aria-label={soundOn ? "Mute assistant" : "Unmute assistant"} onClick={() => {
            setSoundOn((current) => !current);
            window.speechSynthesis?.cancel();
            setSpeaking(false);
          }}>{soundOn ? <Volume2 /> : <VolumeX />}</button>
          <div className="profile">VS</div>
        </div>
      </header>

      <div className="workspace">
        <aside className="left-rail glass-panel">
          <section>
            <div className="section-label"><Activity size={13} /> Active operations</div>
            <div className="mission-list">
              {missions.map((mission) => (
                <article className="mission-card" key={mission.id}>
                  <div className="mission-head">
                    <span className={`status-icon ${mission.status}`}>
                      {mission.status === "complete" ? <Check size={12} /> : mission.status === "active" ? <CircleDot size={12} /> : <Pause size={11} />}
                    </span>
                    <span>{mission.title}</span>
                  </div>
                  <p>{mission.detail}</p>
                  <div className="progress-track"><span style={{ width: `${mission.progress}%` }} /></div>
                </article>
              ))}
            </div>
          </section>
          <section className="telemetry">
            <div className="section-label"><Cpu size={13} /> Core telemetry</div>
            <div className="telemetry-grid">
              <div><span>RESPONSE</span><strong>0.42s</strong></div>
              <div><span>CONTEXT</span><strong>98%</strong></div>
              <div><span>UPTIME</span><strong>99.9%</strong></div>
              <div><span>SECURITY</span><strong>LOCKED</strong></div>
            </div>
          </section>
          <div className="secure-note"><ShieldCheck size={14} /> End-to-end secure channel</div>
        </aside>

        <section className="conversation glass-panel">
          <div className="conversation-head">
            <div><span className="section-label"><Radio size={13} /> Live channel</span><h1>Direct interface</h1></div>
            <button className={`continuous-toggle ${continuous ? "enabled" : ""}`} onClick={() => setContinuous((current) => !current)}>
              {continuous ? <Pause size={13} /> : <Play size={13} />} Continuous {continuous ? "on" : "off"}
            </button>
          </div>
          <div className="transcript">
            <div className="timeline-line" />
            {messages.map((message, index) => (
              <article className={`message ${message.role}`} key={`${message.time}-${index}`}>
                <div className="avatar">{message.role === "assistant" ? <Bot size={17} /> : "V"}</div>
                <div className="message-body">
                  <div className="message-meta"><strong>{message.role === "assistant" ? "APEX" : "YOU"}</strong><span>{message.time}</span></div>
                  <p>{message.content}</p>
                </div>
              </article>
            ))}
            {thinking && <article className="message assistant">
              <div className="avatar"><Bot size={17} /></div>
              <div className="message-body thinking"><span /><span /><span /></div>
            </article>}
            <div ref={messagesEndRef} />
          </div>
          <div className="composer-wrap">
            {notice && <div className="notice">{notice}<button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={14} /></button></div>}
            <form className="composer" onSubmit={submit}>
              <button type="button" className={`mic-small ${listening ? "recording" : ""}`} onClick={listening ? stopListening : startListening} aria-label={listening ? "Stop listening" : "Start listening"}>
                {listening ? <MicOff /> : <Mic />}
              </button>
              <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Issue a directive or ask anything…" aria-label="Message APEX" />
              <Button type="submit" size="icon-lg" disabled={!input.trim() || thinking} className="send-button" aria-label="Send message"><Send /></Button>
            </form>
            <p className="composer-hint">Voice and keyboard active • Press Enter to transmit</p>
          </div>
        </section>

        <aside className="right-rail">
          <section className="orb-panel glass-panel">
            <div className="orb-label"><AudioWaveform size={14} />{listening ? "LISTENING" : speaking ? "RESPONDING" : thinking ? "PROCESSING" : "STANDBY"}</div>
            <button className={`orb ${listening ? "is-listening" : ""} ${speaking ? "is-speaking" : ""}`} onClick={listening ? stopListening : startListening} aria-label="Activate voice assistant">
              <span className="orbit orbit-a" /><span className="orbit orbit-b" /><span className="orb-core"><Sparkles size={24} /></span>
            </button>
            <h2>{listening ? "I’m listening…" : "How can I assist?"}</h2>
            <p>Tap the core to begin a secure voice exchange.</p>
          </section>
          <section className="brief-panel glass-panel">
            <div className="section-label"><Terminal size={13} /> Intelligence brief</div>
            <div className="brief-item"><span>01</span><div><strong>Focus window</strong><p>Your next open block begins at 22:30.</p></div><ChevronRight size={14} /></div>
            <div className="brief-item"><span>02</span><div><strong>Priority signal</strong><p>Product review is nearing completion.</p></div><ChevronRight size={14} /></div>
          </section>
        </aside>
      </div>

      <footer>
        <span>APEX CORE 7.4.2</span><span><span className="live-dot" /> ENCRYPTED SESSION</span><span>LOCAL TIME {now()}</span>
      </footer>
    </main>
  );
}
