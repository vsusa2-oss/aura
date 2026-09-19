# AI agent productivity system — architecture plan

Scope: scaffold + architecture for four requested pieces, spanning `aura` (this repo,
the APEX Operations Deck) and `agent-hq-website` (the public org directory). Nothing
here needs new secrets to build or run — every piece follows APEX's existing pattern of
"attempt the real integration, fall back honestly when it isn't configured."

## Why one more framework instead of hand-rolling four integrations

Hooking aura directly to Google Calendar, Gmail, an Obsidian vault, and a cron-driven
review loop means building and maintaining four separate credentialed integrations
inside a Next.js app that has no persistent disk and no background process.

[Hermes Agent](https://github.com/NousResearch/hermes-agent) (Nous Research, MIT) already
is that backend: a self-hosted agent with a cron scheduler, a persistent memory layer
(FTS5, cross-session recall, per-user profile), an MCP/tool system for connecting
Calendar, Gmail, and a filesystem vault, and a messaging gateway (Telegram, Discord,
Slack, WhatsApp, Signal, plus arbitrary webhooks — where the `vsagent@agentmail.to`
address slots in as an email channel). Running it costs a $5 VPS or a Docker container;
aura talks to it over one small HTTP bridge instead of reimplementing its tool system.

Division of labor:

- **Hermes Agent** (self-hosted, out of this repo) — the actual brain. Holds the
  Calendar/Gmail/vault credentials, runs the cron jobs, owns the memory layer.
- **aura / APEX** (this repo) — the voice-first cockpit. Displays what Hermes produces,
  drives the existing Task Board and voice pipeline, and is the thing the operator
  actually talks to.
- **agent-hq-website** — the public identity layer. Smith (HQ Lead) is already the
  human-facing persona for "one interface, routes everything"; Hermes is the runtime
  behind that persona, not a new character. No roster changes needed for this scaffold.

## 1. Life Dashboard

`src/lib/apex/dashboard.ts` + `GET /api/dashboard` ask the Hermes gateway for a
snapshot (`briefing`, `calendar`, `email`, `tasks`). Same shape as `/api/capabilities`:
`{ configured: false }` with no `HERMES_GATEWAY_URL` set, never a hard failure.

Next step (not in this scaffold): a `Dashboard` panel/tab in `apex-deck.tsx` that
renders the payload, following the existing `Telemetry` panel's layout.

## 2. Second Brain (Obsidian)

The vault itself lives outside this repo — point Hermes at the Obsidian folder via its
own filesystem/MCP tool on the host it runs on, so it gets indexed into Hermes's memory
layer (FTS5) rather than re-read on every request. `src/lib/apex/second-brain.ts` +
`GET /api/second-brain?q=` is a thin search client against that index. This keeps aura
stateless, which matters if it ever deploys somewhere serverless (Vercel) where a
mounted vault folder wouldn't survive between invocations.

## 3. Executive Assistant Agent

`src/lib/apex/executive-assistant.ts` + `/api/checkin` (`GET` for cron, `POST` for a
manual trigger from the deck) ask Hermes to run a daily-morning briefing, a nightly
review, or a weekly rollup, and hand back a spoken-ready summary. `vercel.json` wires
three cron schedules to it (07:00 morning, 22:00 nightly, Sunday 18:00 weekly) — adjust
the times once this deploys somewhere with cron support; Hermes's own cron scheduler can
also own this end-to-end and just push the summary to aura instead.

## 4. AI Workforce

This is the shape all three pieces above already assume: Hermes as chief of staff,
reachable through its tool system and MCP servers, with aura as the cockpit the operator
actually talks to and agent-hq-website as the public roster of who's who. No separate
build item — it's what having 1–3 wired up *is*.

## Voice: advancing past plain TTS

Today `/api/speak` is one-shot ElevenLabs TTS (turbo model, streamed MP3) behind
`useVoice`. That pipeline is real and low-latency for the interactive cockpit — keep it.
ElevenLabs' separate Conversational AI / Agents Platform product (full-duplex, built-in
tool calling, phone numbers) is worth adding as a second surface for things the turbo
pipeline can't do — an outbound call reading the morning briefing when the operator
isn't at the deck — not as a replacement for the existing chat pipeline. Track it behind
`ELEVENLABS_AGENT_ID`; nothing here wires it up yet.

## New environment variables

See `.env.example`. All optional — every feature above degrades to "not configured"
without them, matching `GEMINI_API_KEY` / `ELEVENLABS_API_KEY` today.

## What this scaffold does not do

- No Google Calendar/Gmail API code in this repo — that lives in Hermes, once deployed.
- No Obsidian vault reader in this repo — same reason.
- No UI wiring into `apex-deck.tsx` yet — the API/lib layer is the foundation; the panel
  is a follow-up once the shape of a real Hermes payload is known.
- No `agent-hq-website` roster changes — the org already models "one routed interface,"
  which is the pattern this system follows.
