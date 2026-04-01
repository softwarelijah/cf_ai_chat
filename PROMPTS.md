# AI Prompts Used

Claude Code (Anthropic's CLI tool, powered by Claude Opus 4) was used as the AI coding assistant throughout development.

## 1. Initial planning and scaffolding

**Prompt:**
> The Cloudflare internship application asks me to build an AI-powered application with: LLM (Llama 3.3 on Workers AI), Workflow/coordination (Workers or Durable Objects), User input via chat or voice, Memory or state. How do I do this?

**Result:** Decided on an AI chat agent with persistent memory. Initially scaffolded with raw Durable Objects, a vanilla HTML chat UI, and manual REST API routes (`/api/chat`, `/api/history`, `/api/clear`).

**What was generated:**
- `wrangler.toml` with AI binding and Durable Object migration
- Worker entry point with API routing and LLM orchestration
- Durable Object class with lazy-loaded message persistence
- Vanilla HTML/CSS/JS chat frontend

## 2. Discovering and rebuilding with the Agents SDK

**Prompt:**
> Cloudflare has a dedicated Agents SDK with AIChatAgent, built-in SQLite state, React hooks, tool support, and scheduling. Rebuild the project properly using their SDK instead of raw Durable Objects.

**What I learned:** The raw Durable Object approach was reinventing what the Agents SDK already provides. Key differences:
- `AIChatAgent` gives you SQLite message persistence, resumable streams, and WebSocket management out of the box
- `useAgent` + `useAgentChat` React hooks replace manual fetch calls
- `@cloudflare/vite-plugin` + `agents/vite` integrate Wrangler into Vite's dev server
- `wrangler.jsonc` with `new_sqlite_classes` migration instead of `wrangler.toml` with `new_classes`

**What changed:**
- Replaced raw Durable Object class with `AIChatAgent` from `@cloudflare/ai-chat`
- Replaced vanilla HTML with React 19 + `useAgentChat` / `useAgent` hooks
- Added Vite build pipeline with `@cloudflare/vite-plugin`
- Added Tailwind CSS 4
- Switched to `wrangler.jsonc` with `new_sqlite_classes` migration

## 3. Tool and feature implementation

**Prompt:**
> Include server-side tools (weather, calculations), a client-side tool (timezone from browser), and task scheduling so the agent can remind users of things.

**What was generated:**
- `getWeather` tool with mock data and server-side auto-execute
- `getUserTimezone` client-side tool handled by `onToolCall` in the React hook
- `calculate` tool for math evaluation
- `scheduleTask` / `getScheduledTasks` / `cancelScheduledTask` tools using Durable Object alarm scheduling (`this.schedule()`, `this.getSchedules()`, `this.cancelSchedule()`)
- `onTaskScheduled` callback that notifies clients via `this.setState()`
- Tool result and approval UI components in the React frontend

## 4. Debugging and iteration

Several issues were encountered and fixed through iterative prompting:

**White screen on dev:**
> When I run npm run dev, the screen is just white.

Fix: The initial `vite.config.ts` was missing `@cloudflare/vite-plugin` and `agents/vite` plugins. The starter template uses these to integrate Wrangler's dev server with Vite, which is required for Durable Objects and Workers AI to work in dev mode.

**Runtime crash (`Cannot read properties of undefined (reading 'trim')`):**
> The app crashes with a trim() error.

Fix: The AI SDK v6 changed its API. `useChat` no longer returns `input`, `handleInputChange`, `handleSubmit`, or `isLoading`. Rewrote the component to manage input state locally with `useState` and use `sendMessage()` + `status` from the new API.

**Invalid prompt error (`expected array, received Promise`):**
> InvalidPromptError: The messages do not match the ModelMessage[] schema.

Fix: `convertToModelMessages()` returns a Promise in the current version. Added `await` before passing to `streamText()`.

**Model outputting raw JSON instead of making tool calls:**
> The AI responds with raw JSON like `{"type": "function", "name": "getWeather"}` instead of actually calling tools.

Fix: Aligned with the official starter template's pattern:
- Changed `onChatMessage` signature to `(_onFinish: unknown, options?: OnChatMessageOptions)` instead of using `onFinish` directly
- Wrapped messages with `pruneMessages()` 
- Replaced `maxSteps: 5` with `stopWhen: stepCountIs(5)`
- Passed `abortSignal: options?.abortSignal`
- Removed `onFinish` from `streamText` (the SDK handles persistence internally)

## 5. Design decisions

These were discussed with the AI assistant and informed the final architecture:

- **Why `AIChatAgent` over raw Durable Objects:** Built-in SQLite message persistence, resumable streams, and WebSocket lifecycle management eliminate significant boilerplate
- **Why Vercel AI SDK v6 (`ai` package):** Provides `streamText`, `tool()`, `convertToModelMessages`, `pruneMessages`, and `stepCountIs` that integrate directly with the Agents SDK's streaming response format
- **Why Tailwind over Kumo UI:** Kept the UI lightweight with Tailwind to reduce dependency surface area and demonstrate understanding of the underlying component patterns
- **Scheduling via Durable Object alarms:** Tasks are persisted in SQLite and survive restarts, unlike in-memory `setTimeout`. The `onTaskScheduled` method notifies clients through state sync rather than injecting into chat history (which would cause the LLM to re-trigger the same task)
- **Client-side timezone tool:** Demonstrates the client-side tool pattern where the server defines the tool schema but the browser provides the result, showing understanding of the SDK's tool execution model
