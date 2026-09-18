# APEX Interface

A circa-2017 **digital liaison** UI: real-time streaming dialogue, voice in/out, and a **mission log** that tracks work you assign in conversation.

## Features

- HUD-style interface with live transcript and central core visualizer
- **Continuous conversation** via streaming chat (SSE)
- **Voice input** (Web Speech API) and **voice output** (ElevenLabs or browser TTS)
- **Task reporting**: APEX logs missions and status updates to the mission panel
- **AI backends**: Google Gemini (preferred) or OpenAI — demo mode without keys

## Run locally

```bash
npm install
cp .env.example .env.local   # add API keys as needed
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

## Environment

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Primary chat model (Gemini) |
| `OPENAI_API_KEY` | Fallback chat if Gemini is unset |
| `ELEVENLABS_API_KEY` | Premium TTS; without it, the browser speaks responses |

## Usage

1. Type a directive or tap the microphone.
2. Toggle **Voice out** to hear replies.
3. Toggle **Hands-free** to reopen the mic after APEX finishes speaking.
4. Assign work in natural language — missions appear in **Mission log** when the model emits task markers (or in demo mode when you use words like “build” / “deploy”).

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion, Gemini / OpenAI streaming APIs.
