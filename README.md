# Qasem Chatbot

A full-stack chatbot: an Express/TypeScript backend that streams responses
from a local [Ollama](https://ollama.com/) model, and a React/Vite frontend
chat UI. Fully free — no API key, no cloud billing, everything runs on your
machine.

## Structure

- `server/` — Express API. Calls a local Ollama model and streams responses
  over Server-Sent Events. Keeps per-session conversation history in memory.
- `client/` — React chat UI (Vite). Talks to the server via `/api/*`
  (proxied to `http://localhost:3001` in dev).

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ and npm.
- [Ollama](https://ollama.com/) installed and running, with a model pulled:
  ```bash
  ollama pull llama3.2
  ```
  Ollama runs as a background service after install and listens on
  `http://localhost:11434` — no API key needed.

## Setup

```bash
# from the repo root
npm install

# configure the server (defaults already work if you used `llama3.2`)
cp server/.env.example server/.env
```

## Run (development)

```bash
npm run dev
```

This starts both the server (http://localhost:3001) and the client
(http://localhost:5173) together. Open http://localhost:5173 in your
browser. Make sure Ollama is running first (`ollama serve`, or it's already
running as a background service after install).

## Run individually

```bash
npm run dev -w server   # API only
npm run dev -w client   # frontend only
```

## Build for production

```bash
npm run build
# server/dist/index.js  — run with `node server/dist/index.js`
# client/dist/          — static assets, serve with any static host
```

## How it works

- The client generates a random session ID (stored in `localStorage`) and
  sends it with every message so the server can keep track of that
  conversation's history.
- `POST /api/chat/stream` forwards the conversation to Ollama's
  `/api/chat` endpoint and relays the response back as SSE (`delta` events
  with text chunks, then a `done` event, or an `error` event on failure).
- `POST /api/chat/reset` clears a session's history (used by "New chat").
- Conversation history is stored in memory on the server — restarting the
  server clears all conversations. Swap `conversations` (a `Map`) in
  `server/src/index.ts` for a real store (Redis, a database) if you need
  persistence across restarts or multiple server instances.

## Customizing

- System prompt: set `CHATBOT_SYSTEM_PROMPT` in `server/.env`.
- Model: set `OLLAMA_MODEL` in `server/.env` to any model you've pulled
  (`ollama pull <model>`, see https://ollama.com/library for options —
  e.g. `qwen2.5`, `gemma2:2b`, `mistral`).
- Ollama location: set `OLLAMA_BASE_URL` in `server/.env` if Ollama runs
  elsewhere.
- Port: set `PORT` in `server/.env` (defaults to `3001`); update
  `client/vite.config.ts`'s proxy target if you change it.

## Switching back to the Claude API

If you'd rather use the (paid) Claude API for higher-quality responses, see
git history for the original Anthropic SDK-based `server/src/index.ts`, or
ask to have it re-added — it's a small swap (replace the Ollama `fetch` call
with `client.messages.stream(...)` from `@anthropic-ai/sdk`).
