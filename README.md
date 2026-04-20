# Murder Mystery AI

An AI-powered murder mystery detective game built on **Vercel Workflows** and the **Vercel AI SDK**. Players take on the role of a detective, interrogating AI-driven suspects to uncover a murderer. Each persona is a DurableAgent with unique secrets, alibis, and personalities, all orchestrated through a single parent workflow.

### → [Architectural Decisions](#architectural-decisions)

## Features

- Multi-turn suspect interrogation with AI-powered personas that stay in character
- Procedurally generated murder mystery scenarios with suspects, secrets, and alibis
- Real-time streaming updates as suspects respond, react, and emote
- Per-persona tools for checking emotional state and triggering visible events
- Game state management with mood, sanity, and event tracking across suspects
- Session persistence and resumption via URL with automatic reconnection

## Vercel Technology

### Vercel Workflows with Parent-Child Composition

The application centers on a **Vercel Workflow** (`workflow` v4.2.0-beta) that manages the entire game lifecycle. The parent workflow `playGameWorkflow` in [`src/workflows/play-game.ts`](src/workflows/play-game.ts) is defined with the `"use workflow"` directive and integrated into Next.js via `withWorkflow()` in `next.config.ts`.

The parent workflow generates the murder scenario, publishes game state, then enters an event loop listening for game events via `gameEventHook`. When a player sends a chat message to a persona, the parent spawns a child `personaChatWorkflow` via **direct await (flattening)**. The child's steps execute inline within the parent's context, appearing in the parent's event log as if called directly:

```ts
// Parent event loop handles chat messages
case "chat-message": {
  const result = await personaChatWorkflow({
    gameId, personaId, personaName, personaSecret,
    messages,          // past messages for THIS persona only
    writable,          // persona-namespaced stream
    currentGameState,  // latest game state
  });
  messages.push(...result.newMessages);
}
```

The parent tracks all per-persona state (message histories, turn counts, step counts) in Maps, and each persona writes to its own namespaced stream (`persona-{id}`).

`gameEventHook` handles all game-level events: `chat-message` (triggers persona child workflow), `accuse`, `end-game`, `add-event`, `update-mood`, and `end-persona-chat` (cleans up persona state).

**DurableAgent** from `@workflow/ai/agent` provides a stateful AI agent for each persona. The child workflow creates a `DurableAgent` with a persona-specific system prompt and tools, runs a single turn, and returns the new messages to the parent.

**Workflow Observability**: The workflow emits structured data markers via `getWritable()` throughout execution, including turn numbers, step counts, timing, and tool call telemetry.

### Vercel AI SDK

The application uses **AI SDK** v6 (`ai` and `@ai-sdk/react`) for agent interaction, streaming, and React integration.

- **Claude Sonnet 4.6** (`anthropic/claude-sonnet-4-6`) powers each persona's DurableAgent for in-character reasoning and tool use
- `useChat` from `@ai-sdk/react` with `WorkflowChatTransport` from `@workflow/ai` provides workflow-aware chat state management
- `createUIMessageStreamResponse` enables token-level streaming from API routes
- Data workflow markers stream real-time status updates, game state, and turn observability to the frontend

### Tools as Durable Steps

Persona agents have two tools, both executing as durable steps:

| Tool | Purpose |
|------|---------|
| `get_current_state` | Returns the persona's mood, sanity, and recent events |
| `add_event` | Emits a visible reaction that other characters and the detective observe |

## Architecture

```
Frontend (Next.js App Router)
  ├── GameInterface
  │     ├── PersonaCard (select suspect)
  │     └── PersonaChatPanel ─── usePersonaChat() ─── WorkflowChatTransport
  └── EventLog (global game events)

API Routes
  ├── POST /api/run                              → start(playGameWorkflow)
  ├── GET  /api/run/[gameId]/state               → read game-state namespace
  ├── POST /api/run/[gameId]/event               → gameEventHook.resume() [accuse, end-game, end-persona-chat]
  ├── POST /api/agent/[personaId]/stream          → gameEventHook.resume() [chat-message] + persona stream
  ├── GET  /api/agent/[personaId]/stream/[gameId] → reconnect to persona namespace
  └── POST /api/agent/[personaId]/stream/[gameId] → gameEventHook.resume() [chat-message follow-up]

Workflow (Vercel Workflows)
  └── playGameWorkflow (parent)
        ├── Scenario generation steps (mock)
        ├── gameEventHook event loop
        ├── Per-persona namespaced streams
        └── personaChatWorkflow (child, flattened via direct await)
              ├── DurableAgent (Claude Sonnet 4.6)
              └── Tools: get_current_state, add_event
```

## Architectural Decisions

### 1. Single Parent Workflow Per Game

Each game session is a single, long-running `playGameWorkflow` instance. The entire game lifecycle (scenario generation, state management, all persona conversations) lives inside one workflow run. Chat messages, accusations, and other events are injected via `gameEventHook` rather than starting new runs.

---

### 2. Parent-Child Workflow Composition via Direct Await

Persona conversations run as child workflows called via `await personaChatWorkflow(...)` (direct await / flattening). The child's steps execute inline within the parent's event log.

This approach keeps a single unified event log for the entire game while allowing persona logic to live in a separate, focused module. The parent maintains per-persona message histories in Maps and passes only the relevant persona's messages to each child invocation.

**Rejected alternative:** Starting separate workflow runs via `start()` required cross-workflow communication through hooks and stream reading, adding complexity for state synchronization.

---

### 3. Per-Persona Namespaced Streams

Each persona gets a dedicated namespaced writable stream (`persona-{id}`) within the parent workflow. This allows the client to connect to a specific persona's conversation stream without receiving data from other personas or game-level events.

---

### 4. Single-Turn Child Workflow

The persona child workflow handles exactly one agent turn per invocation. The parent manages the multi-turn loop through its event loop, calling the child again for each new message. This keeps the child stateless and makes the parent the single source of truth for conversation state.

---

### 5. Per-Persona State Cleanup via `end-persona-chat`

When the client ends a persona conversation, it sends an `end-persona-chat` event to the parent workflow. The parent closes that persona's namespaced stream and clears the associated Maps (messages, turn counts, step counts). This frees resources while the game continues running for other personas.

---

### 7. Session Persistence via URL + `localStorage` + Stream Reconnection
The workflow run ID is persisted in both `localStorage` and as a `?session=` URL query parameter. On page load, `useMultiTurnChat` checks for an existing run ID and reconnects to the live stream via `GET /api/chat/[id]/stream`. This allows sharing sessions by URL and surviving page refreshes without losing state.

---

### 8. In-Memory Store (POC-First, No Database)
Product and category data live in JSON fixtures in `lib/data/`. Approved saves update an in-memory mutable store (`lib/data/store.ts`). No database, no auth, no persistence across server restarts.

**Why:** The project constitution mandates POC-first simplicity. Introducing a database would add operational complexity before the core AI workflow is validated.

---

### 9. Zod Schemas as the Shared Type Layer
Zod schemas in `lib/schemas/` serve three purposes simultaneously:
1. **Runtime validation** — Tool inputs are validated via `inputSchema` Zod objects
2. **Structured generation** — `Output.object({ schema })` passes the Zod schema directly to `generateText` for constrained LLM output
3. **TypeScript types** — `z.infer<typeof schema>` provides static types across the codebase

One schema definition serves all three concerns with zero duplication.

---

### 10. `FatalError` vs. `RetryableError` for Workflow Failures
Tools use Vercel Workflows' error classification:
- `FatalError` — for validation failures (e.g., missing content fields, invalid update payloads) that should never be retried
- `RetryableError` — for transient failures (e.g., LLM API timeouts) that benefit from automatic retry

This prevents infinite retry loops on logic errors while enabling automatic recovery from network-level failures.

---

### 11. Generated Content Is Never Echoed in Chat
The system prompt explicitly instructs the agent **not** to repeat or summarize generated descriptions or SEO data in its chat response. All content is surfaced exclusively via the streaming `data-product-content`/`data-category-content` parts rendered in the catalog panel.

**Why:** Duplicating content in the chat creates noisy, hard-to-read conversations and wastes output tokens. The data part stream is the canonical content channel.

---

### 12. Eval Strategy: Deterministic Mocks + Optional Live LLM
The eval suite (`src/__tests__/evals/`) tests agent behavior at two levels:

- **Mocked evals** — `MockLanguageModelV3` from `ai/test` replays scripted tool-call sequences deterministically. Tool `execute` functions are replaced with `vi.fn()` mocks. Assertions target tool names, parameter shapes, and call ordering — not LLM text output. These run in under 60 seconds with no API dependency.
- **Live LLM evals** — Same mock tool `execute` functions, but real `anthropic/claude-haiku-4-5` model reasoning. Gated by `EVAL_LIVE_LLM` + `AI_GATEWAY_API_KEY` env vars. Validates that the system prompt produces correct tool routing with real model inference.

`DurableAgent` is tested directly (bypassing the workflow runtime) by passing a mock model via the function form: `model: () => Promise.resolve(mockModel)`.

---

## Getting Started

```bash
npm install
cp .env.example .env.local
# Add your Vercel AI Gateway key
# AI_GATEWAY_API_KEY=your_key_here
npm run dev
```

The app runs on [http://localhost:3000](http://localhost:3000).

## Evaluations

The project includes an evaluation suite in [`src/__tests__/evals/`](src/__tests__/evals/) that validates agent behavior using the `DurableAgent` directly — testing tool selection, ordering, parameter correctness, and multi-turn flows.

### Running Evals

```bash
# Run mocked evals (fast, deterministic, no API calls)
npm run test:evals

# Run with live LLM evals included (requires API key, ~120s timeout per test)
EVAL_LIVE_LLM=1 npm run test:evals
```

### Eval Structure

Each eval file contains two test suites: a **mocked suite** for fast deterministic testing and an optional **live LLM suite** (gated behind `EVAL_LIVE_LLM`) that runs against a real model (`anthropic/claude-haiku-4-5`).

**Mocked evals** use a `MockLanguageModelV3` ([`helpers/mock-model.ts`](src/__tests__/evals/helpers/mock-model.ts)) that replays scripted tool call sequences. Tool implementations are replaced with `vi.fn()` mocks ([`helpers/mock-tool-responses.ts`](src/__tests__/evals/helpers/mock-tool-responses.ts)) that return fixture data. This allows asserting exact tool call order, parameters, and absence of unwanted calls without any API dependency.

**Live LLM evals** use the same mock tool implementations but a real model, validating that the agent's system prompt produces correct tool routing when given natural language inputs.

### Eval Coverage

| Eval File | What It Tests |
|-----------|--------------|
| [`optimize-descriptions.eval.test.ts`](src/__tests__/evals/optimize-descriptions.eval.test.ts) | Description generation flow: `get_products` → `get_brand_voice` → `generate_descriptions`. Verifies category filtering, brand voice ordering, correct parameters, and no save without approval. |
| [`seo-optimization.eval.test.ts`](src/__tests__/evals/seo-optimization.eval.test.ts) | SEO generation flow: `get_products` → `get_brand_voice` → `generate_seo_data`. Verifies tool routing — `generate_descriptions` must NOT be called for SEO-only requests. |
| [`save-approval.eval.test.ts`](src/__tests__/evals/save-approval.eval.test.ts) | Multi-turn approval flow: Turn 1 generates content (no save), Turn 2 saves after user approval. Validates correct SKUs, update structure (content or seoContent present), and that all 6 electronics products are included. |
| [`edge-cases.eval.test.ts`](src/__tests__/evals/edge-cases.eval.test.ts) | Edge cases: empty category returns no generation calls, "all products" omits `categoryId`, combined description + SEO request calls both generation tools. |

### Key Assertions

- **Tool ordering** — `get_brand_voice` is always called before any generation tool (enforced via `invocationCallOrder`)
- **Tool routing** — SEO requests only trigger `generate_seo_data`, not `generate_descriptions`
- **Safety** — `save_products` is never called without explicit user approval
- **Completeness** — Save operations include all expected SKUs with valid update payloads
- **Edge handling** — Empty results skip generation; broad requests omit category filters

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Workflows:** Vercel Workflows v4.2.0-beta with DurableAgent
- **AI:** Vercel AI SDK v6, Claude Sonnet 4.6 + Haiku 4.5
- **UI:** React 19, Radix UI, Tailwind CSS 4
- **Validation:** Zod 4
- **Testing:** Vitest with mock + live LLM eval modes
