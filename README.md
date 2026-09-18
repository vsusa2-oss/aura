# APEX — Operations Deck

A voice-first interface for a digital assistant. You talk, APEX talks back in real time,
and anything that sounds like a job rather than a question gets taken off you, worked in
the background on a live status board, and reported back into the conversation when it
lands.

The whole thing is one Next.js app. It runs with **zero API keys** — there is a real
fallback behind every external service, not a stub.


## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. Click **Engage · hands free** to grant the microphone, or
**Text only** if you would rather type.

Voice input needs the Web Speech API, which today means Chrome, Edge, or another
Chromium-based browser. Everything else — streaming replies, the assignment engine, the
visualisers — works anywhere, and the deck tells you when the mic is unavailable instead
of silently doing nothing.

## Bringing the real stack online

Copy `.env.example` to `.env.local` and fill in whichever keys you have.

| Variable             | What it turns on                                                        |
| -------------------- | ----------------------------------------------------------------------- |
| `GEMINI_API_KEY`     | Gemini as the reasoning core, streamed token by token                    |
| `GEMINI_MODEL`       | A different Gemini model (default `gemini-2.5-flash`)                    |
| `ELEVENLABS_API_KEY` | ElevenLabs as the voice, streamed as MP3 and analysed for the visualiser |
| `ELEVENLABS_VOICE_ID`| A different ElevenLabs voice                                             |

With no keys set, `/api/capabilities` reports the local core and on-device synthesis, and
the telemetry panel shows amber rather than green so you always know which stack you are
hearing. If Gemini is configured but the call fails mid-stream, the server emits a notice
and finishes the reply on the local core rather than dropping it.

## How it works

**Continuous conversation.** `useSpeechRecognition` keeps a continuous recognition session
open and restarts it whenever Chrome ends one on its own. Final results accumulate until
the operator has been quiet for 1.1 seconds, then the utterance is sent. Replies stream
back as NDJSON and are spoken sentence by sentence, so APEX starts talking before the model
has finished writing.

**Half-duplex by default.** While APEX has the floor the microphone closes, so it never
transcribes its own voice back into the conversation through your speakers. The headphones
toggle in the header switches to barge-in mode, where the mic stays open and your first
syllable cuts APEX off mid-sentence.

**Assignments.** APEX can act on the HUD by emitting a control token inline in its reply:

```
@@APEX{"kind":"assign","title":"Signup funnel dig","brief":"...","priority":"standard","steps":["...","..."]}@@
```

`DirectiveStream` pulls those tokens out of the reply while it is still arriving —
including when a chunk boundary lands in the middle of one — so the operator never sees or
hears them. Each assignment lands on the board with weighted phases, advances on a tick,
and on completion fires a second model call in debrief mode whose answer is appended to the
transcript and spoken. That is the report-back loop.

**The visualisers are real.** One shared `AudioContext` feeds two analysers: the microphone
and APEX's own output. The reactor's radial spectrum is your voice when you are talking and
APEX's when it is. Browser speech synthesis exposes no audio node to tap, so in that one
mode the spectrum is synthesised from a drifting envelope — the deck still shows *when*
APEX is speaking, it just cannot measure it.

## Layout

```
src/
  app/
    api/capabilities/   which reasoning and voice cores are actually configured
    api/chat/           NDJSON reply stream, Gemini with local-core fallback
    api/speak/          ElevenLabs TTS; 204 means "no key, use the browser"
  components/apex/      deck shell, reactor canvas, transcript, task board, telemetry
  hooks/                speech recognition, voice output queue, deck orchestration
  lib/apex/             persona and control protocol, directive parser, local core, audio bus
```

## Checks

```bash
npx tsc --noEmit
npx eslint .
npm run build
```
