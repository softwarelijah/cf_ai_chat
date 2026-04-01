# cf_ai_chat

An AI-powered chat agent built on the Cloudflare Agents SDK. The agent remembers conversations across sessions, can use tools (weather, calculations, scheduling), and runs on Cloudflare's global network via Durable Objects.

## Try it out

See [Running locally](#running-locally) below for setup instructions.

## Architecture

| Requirement | Cloudflare Product | Implementation |
|---|---|---|
| **LLM** | Workers AI (Llama 4 Scout 17B) | Streaming responses via `streamText()` with `workers-ai-provider` |
| **Workflow / Coordination** | Workers + Durable Objects + Agents SDK | `ChatAgent` extends `AIChatAgent`, orchestrates multi-step tool calls, handles WebSocket routing |
| **User Input** | Chat (React SPA via Vite) | Real-time chat UI using `useAgent` and `useAgentChat` React hooks over WebSocket |
| **Memory / State** | Durable Objects (SQLite) | Per-user SQLite database persists messages across restarts, deploys, and hibernation (up to 100 messages) |

### How it works

1. The React frontend connects to the `ChatAgent` Durable Object via WebSocket using the `useAgent` hook
2. User messages are sent through the `useAgentChat` hook, which manages streaming, tool calls, and approvals
3. The `ChatAgent` receives the message, loads persisted conversation history from its SQLite database, prunes it, and streams a response from Llama 4 Scout via Workers AI
4. All messages are automatically persisted in the Durable Object's SQLite storage
5. Tool calls execute server-side (weather, math, scheduling) or client-side (timezone) depending on type
6. Scheduled tasks persist via Durable Object alarms and notify connected clients through state sync

### Tools

| Tool | Type | Description |
|---|---|---|
| `getWeather` | Server-side (auto-execute) | Returns weather data for a given city |
| `getUserTimezone` | Client-side (browser) | Reads the user's timezone via `Intl.DateTimeFormat` |
| `calculate` | Server-side (auto-execute) | Evaluates math expressions |
| `scheduleTask` | Server-side (auto-execute) | Schedules a task to execute after a delay using Durable Object alarms |
| `getScheduledTasks` | Server-side (auto-execute) | Lists all pending scheduled tasks |
| `cancelScheduledTask` | Server-side (auto-execute) | Cancels a scheduled task by ID |

## Running locally

### Prerequisites

- Node.js 18+
- A Cloudflare account (free tier works)

### Setup

```bash
# Clone the repo
git clone https://github.com/elijahmendezcs/cf_ai_chat.git
cd cf_ai_chat

# Install dependencies
npm install --legacy-peer-deps

# Login to Cloudflare (required for Workers AI access)
npx wrangler login

# Start dev server
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

> **Note:** Workers AI requires a Cloudflare login even in local dev because inference runs on Cloudflare's remote GPUs. No API keys are needed.

### Deploy to Cloudflare

```bash
npm run deploy
```

The deployed URL will be printed in the terminal (e.g., `https://cf-ai-chat.almeda.workers.dev`).

## Project structure

```
cf_ai_chat/
├── src/
│   ├── server.ts      # ChatAgent (AIChatAgent + tools + scheduling + Workers AI)
│   ├── app.tsx         # React chat UI with tool rendering and state sync
│   ├── client.tsx      # React entry point
│   └── styles.css      # Tailwind CSS
├── index.html          # Vite HTML entry point
├── wrangler.jsonc      # Workers config (AI binding, Durable Objects, SQLite migration)
├── vite.config.ts      # Vite + React + Cloudflare plugin + Tailwind
├── package.json
├── tsconfig.json
├── PROMPTS.md          # AI prompts used during development
└── README.md
```

## Tech stack

- **Agent Framework:** Cloudflare Agents SDK (`agents`, `@cloudflare/ai-chat`)
- **LLM:** Meta Llama 4 Scout 17B Instruct via Workers AI
- **AI SDK:** Vercel AI SDK v6 (`ai`) for streaming, tool definitions, and message handling
- **State:** Durable Objects with SQLite (automatic message persistence, alarm scheduling)
- **Frontend:** React 19, Tailwind CSS 4, Vite 6
- **Build:** `@cloudflare/vite-plugin` for integrated Workers + Vite dev/build
- **Language:** TypeScript
