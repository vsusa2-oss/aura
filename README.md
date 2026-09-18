# APEX — Digital Operations Officer

A 2017-era HUD for talking to a digital officer in real time. You speak or type. Apex answers out loud, takes the work you assign, runs it in the background, and **reports back** when the brief is ready.

Think Jarvis on the glass: continuous conversation, a live mission board, and a core that actually comes back with results.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: add Gemini / ElevenLabs keys
npm run dev
```

Open [http://localhost:43147](http://localhost:43147).

Tap the microphone to open the voice link (Chrome/Edge work best). Type if the mic is blocked.

## Optional live intelligence

Apex runs on a local core out of the box. Drop keys into `.env.local` to upgrade the brain and the voice:

```bash
# Conversation + mission reports (Gemini)
GEMINI_API_KEY=your_gemini_key

# Optional spoken voice (otherwise the browser voice is used)
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=onwK4e9ZLuTAKqWW03F9
```

The HUD status rail shows `ENGINE GEMINI` or `ENGINE LOCAL`, and `VOICE ELEVEN` or `VOICE LOCAL`.

## What you can do

- **Talk continuously** — after Apex speaks, the link listens again.
- **Assign work** — “research the top three competitors in smart home and draft Monday talking points.”
- **Get reports** — missions progress on the right; Apex files a spoken brief when they complete.
- **Ask for status** — “where are we?”
- **Cancel** — “cancel the competitor scan.”

## Stack

Next.js, TypeScript, Tailwind, shadcn/ui primitives, Gemini for conversation when a key is present, ElevenLabs or the Web Speech API for voice.
