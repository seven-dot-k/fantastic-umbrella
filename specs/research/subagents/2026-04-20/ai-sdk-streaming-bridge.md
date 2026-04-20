# AI SDK Streaming Bridge Research

## Research Topics

1. Consuming AI SDK streams without React hooks (low-level APIs)
2. Tool call results in streams (UIMessageChunk types)
3. Structured game directives mapping to tool system
4. Streaming text for dialogue (text-delta extraction)
5. Event-based communication (hook system mapping)
6. Transport layer considerations for PIXIJS client

## Status: Complete

---

## 1. Consuming AI SDK Streams Without React Hooks

### Key APIs Available (all exported from `'ai'`)

| API | Purpose | Browser-safe |
|-----|---------|-------------|
| `parseJsonEventStream` | Parses raw SSE byte stream into typed `ParseResult<T>` objects | Yes |
| `uiMessageChunkSchema` | Zod schema for validating individual stream chunks | Yes |
| `readUIMessageStream` | Higher-level: transforms `UIMessageChunk` stream → `AsyncIterableStream<UIMessage>` | Yes |
| `DefaultChatTransport` | Full HTTP transport implementing `ChatTransport` interface | Yes |
| `WorkflowChatTransport` (from `@workflow/ai`) | Durable workflow transport with auto-reconnection | Yes |

### Low-Level Approach: `parseJsonEventStream` + `uiMessageChunkSchema`

This is exactly what the project already uses in `src/hooks/use-game.ts`:

```ts
import { parseJsonEventStream, uiMessageChunkSchema } from 'ai';

const response = await fetch('/api/run', { method: 'POST' });
const chunkStream = parseJsonEventStream({
  stream: response.body!,
  schema: uiMessageChunkSchema,
});

const reader = chunkStream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  if (!value.success) continue; // parse error
  const chunk: UIMessageChunk = value.value;
  // Handle each chunk type...
}
```

**How it works internally** (from `@ai-sdk/provider-utils`):
1. `response.body` (raw bytes) → `TextDecoderStream` (text)
2. Text → `EventSourceParserStream` (SSE events via `eventsource-parser`)
3. SSE events → JSON parse + zod validation via schema
4. Output: `ReadableStream<ParseResult<UIMessageChunk>>`

Each SSE event is `data: {json}\n\n` with `data: [DONE]\n\n` as terminator.

### Higher-Level Approach: `readUIMessageStream`

Assembles raw chunks into coherent `UIMessage` objects (accumulates text deltas, tracks tool state):

```ts
import { readUIMessageStream, parseJsonEventStream, uiMessageChunkSchema } from 'ai';

const response = await fetch('/api/agent/butler/stream', { method: 'POST', body: ... });

// First parse raw bytes to UIMessageChunk stream
const chunkStream = parseJsonEventStream({
  stream: response.body!,
  schema: uiMessageChunkSchema,
}).pipeThrough(
  new TransformStream({
    transform(chunk, controller) {
      if (chunk.success) controller.enqueue(chunk.value);
    }
  })
);

// Then assemble into UIMessage updates
for await (const uiMessage of readUIMessageStream({ stream: chunkStream })) {
  // uiMessage.parts contains accumulated state
  for (const part of uiMessage.parts) {
    if (part.type === 'text') console.log(part.text, part.state); // 'streaming' | 'done'
    if (part.type.startsWith('tool-')) handleToolPart(part);
  }
}
```

### Using `ChatTransport` Interface Directly (without React)

The `ChatTransport` interface is simple:

```ts
interface ChatTransport<UI_MESSAGE extends UIMessage> {
  sendMessages(options: {
    trigger: 'submit-message' | 'regenerate-message';
    chatId: string;
    messageId: string | undefined;
    messages: UI_MESSAGE[];
    abortSignal: AbortSignal | undefined;
  } & ChatRequestOptions): Promise<ReadableStream<UIMessageChunk>>;

  reconnectToStream(options: {
    chatId: string;
    // ...
  } & ChatRequestOptions): Promise<ReadableStream<UIMessageChunk> | null>;
}
```

You can instantiate `DefaultChatTransport` or `WorkflowChatTransport` directly without any React hook, call `sendMessages()`, and get back a `ReadableStream<UIMessageChunk>`.

---

## 2. Tool Call Results in Streams — UIMessageChunk Types

### Complete UIMessageChunk Type Catalog

The full discriminated union (from `node_modules/ai/src/ui-message-stream/ui-message-chunks.ts`):

**Text streaming:**
- `{ type: 'text-start', id: string }`
- `{ type: 'text-delta', id: string, delta: string }`
- `{ type: 'text-end', id: string }`

**Tool invocations:**
- `{ type: 'tool-input-start', toolCallId: string, toolName: string, dynamic?: boolean, title?: string }`
- `{ type: 'tool-input-delta', toolCallId: string, inputTextDelta: string }`
- `{ type: 'tool-input-available', toolCallId: string, toolName: string, input: unknown }` — complete input is parsed
- `{ type: 'tool-input-error', toolCallId: string, toolName: string, input: unknown, errorText: string }`

**Tool outputs (results):**
- `{ type: 'tool-output-available', toolCallId: string, output: unknown, preliminary?: boolean }`
- `{ type: 'tool-output-error', toolCallId: string, errorText: string }`
- `{ type: 'tool-output-denied', toolCallId: string }`

**Tool approval (human-in-the-loop):**
- `{ type: 'tool-approval-request', approvalId: string, toolCallId: string }`

**Custom data parts:**
- `{ type: 'data-${string}', id?: string, data: unknown, transient?: boolean }`

**Lifecycle:**
- `{ type: 'start', messageId?: string, messageMetadata?: unknown }`
- `{ type: 'start-step' }`
- `{ type: 'finish-step' }`
- `{ type: 'finish', finishReason?: 'stop' | 'length' | 'tool-calls' | ... }`
- `{ type: 'abort', reason?: string }`
- `{ type: 'error', errorText: string }`

**Other:**
- `{ type: 'reasoning-start/delta/end', ... }` — chain-of-thought
- `{ type: 'source-url', ... }` / `{ type: 'source-document', ... }`
- `{ type: 'file', url: string, mediaType: string }`
- `{ type: 'message-metadata', messageMetadata: unknown }`

### Tool Call Lifecycle in Stream

When the LLM calls a tool like `add_event`:
1. `tool-input-start` — announces tool call with `toolName` and `toolCallId`
2. `tool-input-delta` (0+) — streaming JSON input
3. `tool-input-available` — complete parsed input object
4. _(server executes the tool)_
5. `tool-output-available` — the result from `execute()` as the `output` field

### Assembled UIMessage Part States

When using `readUIMessageStream`, tool parts progress through states:
- `state: 'input-streaming'` — partial input available
- `state: 'input-available'` — full input received
- `state: 'output-available'` — tool executed, output present
- `state: 'output-error'` — tool execution failed

---

## 3. Structured Game Directives Mapping

### Current Tool Pattern (from `src/workflows/tools/add-event.ts`)

```ts
{
  description: "...",
  inputSchema: z.object({ ... }),
  execute: async (input) => { /* side effect + return result */ }
}
```

### Mapping Bridge Spec Tools

The bridge spec's proposed tools map directly to the existing pattern:

```ts
// setNpcMood
const setNpcMood = {
  description: "Update an NPC's current mood in the HUD",
  inputSchema: z.object({
    npcId: z.string(),
    mood: z.string(),
  }),
  execute: async ({ npcId, mood }) => {
    // Mutate game state via closure
    onMoodUpdate(npcId, mood);
    return { success: true, npcId, mood };
  }
};

// addClue
const addClue = {
  description: "Add a discovered clue to the player's clue log",
  inputSchema: z.object({
    clueId: z.string(),
    title: z.string(),
    description: z.string(),
    relatedNpcIds: z.array(z.string()),
  }),
  execute: async (input) => {
    onClueDiscovered(input);
    return { success: true, clue: input };
  }
};

// presentDialogChoices
const presentDialogChoices = {
  description: "Present dialogue choices to the player",
  inputSchema: z.object({
    conversationId: z.string(),
    choices: z.array(z.object({
      id: z.string(),
      label: z.string(),
    })),
  }),
  execute: async (input) => {
    // The PIXIJS client receives this via tool-output-available
    return { presented: true, choices: input.choices };
  }
};
```

### How Results Flow to Client

1. LLM decides to call `setNpcMood` or `addClue`
2. Stream emits `tool-input-start` → `tool-input-delta` → `tool-input-available`
3. Server executes the tool (via `execute` function)
4. Stream emits `tool-output-available` with the return value
5. PIXIJS client receives the chunk and dispatches to the appropriate handler

**Key insight**: The PIXIJS client can filter chunks by `toolName` to route directives:

```ts
if (chunk.type === 'tool-output-available') {
  // Look up the toolName from the tracked tool calls
  const toolInfo = activeToolCalls.get(chunk.toolCallId);
  switch (toolInfo?.toolName) {
    case 'setNpcMood': handleMoodDirective(chunk.output); break;
    case 'addClue': handleClueDirective(chunk.output); break;
    case 'presentDialogChoices': handleChoices(chunk.output); break;
  }
}
```

Or use `tool-input-available` to react immediately (e.g., show "NPC is thinking...").

---

## 4. Streaming Text for Dialogue

### Low-Level: Direct `text-delta` Chunks

For character-by-character rendering in PIXIJS:

```ts
const chunkStream = parseJsonEventStream({ stream: response.body!, schema: uiMessageChunkSchema });
const reader = chunkStream.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  if (!value.success) continue;

  const chunk = value.value;
  if (chunk.type === 'text-delta') {
    // chunk.delta contains the text fragment (often 1-5 tokens / words)
    pixiDialogueBox.appendText(chunk.delta);
  } else if (chunk.type === 'text-end') {
    pixiDialogueBox.finishText();
  }
}
```

**Delta characteristics:**
- Each `text-delta` contains a small text fragment (typically 1-20 characters from SSE)
- They arrive in order, keyed by `id` (same `id` for all deltas of one text block)
- `text-start` signals beginning, `text-end` signals completion

### Higher-Level with `readUIMessageStream`

Each iteration gives you the accumulated state:

```ts
for await (const msg of readUIMessageStream({ stream: chunkStream })) {
  const textPart = msg.parts.find(p => p.type === 'text');
  if (textPart) {
    // textPart.text contains ALL text so far (accumulated)
    // textPart.state is 'streaming' or 'done'
    pixiDialogueBox.setText(textPart.text);
  }
}
```

**Trade-off**: Low-level (`text-delta`) is better for typewriter-style rendering. High-level (`readUIMessageStream`) is better for "replace whole text" rendering.

---

## 5. Event-Based Communication — Hook System Mapping

### Current Hook System

```ts
// Definition (workflow side)
export const gameEventHook = defineHook({
  schema: z.object({
    type: z.enum(["accuse", "end-game", "get-state", "add-event", "update-mood", "chat-message", "end-persona-chat"]),
    personaId: z.string().optional(),
    description: z.string().optional(),
    // ...
  }),
});

// Sending events (API route → hook → workflow)
await gameEventHook.resume(gameId, { type: "accuse", personaId: "butler" });
```

### Bridge Spec Event Types Mapping

| Bridge Event | Current Hook Equivalent | Notes |
|---|---|---|
| `interaction-start` | `chat-message` | First message to a persona starts interaction |
| `dialogue-choice` | `chat-message` + choice content | Player's selected choice sent as message |
| `accusation-submit` | `accuse` + `personaId` | Already implemented |
| `interaction-end` | `end-persona-chat` | Already implemented |
| `clue-inspect` | Could be new `chat-message` to persona | Or new hook type |

### How Well Does It Map?

**Good fit:**
- The hook system already supports typed events with zod validation
- The `gameEventHook.resume(gameId, event)` pattern maps perfectly to `NarrativeBridge.submitAccusation(event)` on the bridge spec
- API routes provide the HTTP boundary between client and workflow

**Gaps:**
- The hook schema is a single flat discriminated union. The bridge spec proposes distinct event types with different payloads. This can be handled by expanding the enum or using separate hooks per event type.
- `WorkflowChatTransport` already handles the `chat-message` case via `useChat`'s send mechanism (POST to `/api/agent/[personaId]/stream`). For PIXIJS without React, you'd call the same endpoints via fetch.

### PIXIJS Adapter Implementation

```ts
class NarrativeBridge {
  async startInteraction(personaId: string, message: string) {
    // POST /api/agent/{personaId}/stream with body { messages, gameId }
    const response = await fetch(`/api/agent/${personaId}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [...], gameId, trigger: 'submit-message' }),
    });
    return this.consumeStream(response.body!);
  }

  async sendChoice(choice: string) {
    // Same endpoint, new message appended
  }

  async submitAccusation(personaId: string) {
    // POST /api/run/{gameId}/event with { type: "accuse", personaId }
    await fetch(`/api/run/${gameId}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: "accuse", personaId }),
    });
  }
}
```

---

## 6. Transport Layer Recommendations

### Option A: Raw fetch + `parseJsonEventStream` (Recommended for PIXIJS)

```ts
import { parseJsonEventStream, uiMessageChunkSchema } from 'ai';

async function* streamNarrativeResponse(url: string, body: object): AsyncGenerator<UIMessageChunk> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const chunkStream = parseJsonEventStream({
    stream: response.body!,
    schema: uiMessageChunkSchema,
  });

  for await (const result of chunkStream) {
    if (result.success) yield result.value;
  }
}
```

**Pros:**
- No React dependency
- Full control over chunk processing
- Can filter/route chunks directly to PIXIJS subsystems
- Minimal bundle size (only `ai` package needed)

**Cons:**
- No built-in reconnection (must implement manually)

### Option B: `WorkflowChatTransport` Without React

```ts
import { WorkflowChatTransport } from '@workflow/ai';

const transport = new WorkflowChatTransport({
  api: `/api/agent/${personaId}/stream`,
  onChatEnd: () => { /* cleanup */ },
});

// Send messages
const stream = await transport.sendMessages({
  trigger: 'submit-message',
  chatId: `${gameId}-${personaId}`,
  messages: [...],
  abortSignal: controller.signal,
});

// Consume the stream
const reader = stream.getReader();
// ...

// Reconnect after disconnect
const resumeStream = await transport.reconnectToStream({
  chatId: `${gameId}-${personaId}`,
});
```

**Pros:**
- Auto-reconnection built in (handles Vercel Function timeouts)
- `startIndex` support for resuming from a position
- Same wire protocol as existing React-based implementation

**Cons:**
- Slightly larger dependency
- Must manage `messages` array manually (React's `useChat` does this)

### Option C: Thin Wrapper (Best of Both)

Build a `NarrativeBridge` class that:
1. Uses `WorkflowChatTransport` internally for send + reconnect
2. Exposes event-emitter style callbacks for PIXIJS:

```ts
class NarrativeBridge {
  private transport: WorkflowChatTransport;
  private activeToolCalls = new Map<string, { toolName: string }>();

  onTextDelta: (delta: string) => void;
  onDirective: (toolName: string, output: unknown) => void;
  onInteractionComplete: () => void;

  async startInteraction(personaId: string, userMessage: string) {
    const stream = await this.transport.sendMessages({ ... });
    this.consumeStream(stream);
  }

  private async consumeStream(stream: ReadableStream<UIMessageChunk>) {
    const reader = stream.getReader();
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;

      switch (chunk.type) {
        case 'text-delta':
          this.onTextDelta?.(chunk.delta);
          break;
        case 'tool-input-start':
          this.activeToolCalls.set(chunk.toolCallId, { toolName: chunk.toolName });
          break;
        case 'tool-output-available':
          const info = this.activeToolCalls.get(chunk.toolCallId);
          if (info) this.onDirective?.(info.toolName, chunk.output);
          break;
        case 'finish':
          this.onInteractionComplete?.();
          break;
      }
    }
  }
}
```

### Reconnection for Durable Workflows

The `WorkflowChatTransport` handles reconnection via:
- GET `{api}/{runId}/stream?startIndex={n}` endpoint
- `x-workflow-stream-tail-index` header for negative offset support
- Automatic retry with `maxConsecutiveErrors` (default 3)
- Resumes from exact chunk position after network interruption

If using raw fetch, implement reconnection manually:

```ts
async function reconnect(runId: string, lastChunkIndex: number) {
  const res = await fetch(`/api/agent/${personaId}/stream/${runId}/stream?startIndex=${lastChunkIndex}`);
  // Process stream from where we left off
}
```

---

## Key References

- `node_modules/ai/src/ui-message-stream/ui-message-chunks.ts` — Full UIMessageChunk discriminated union
- `node_modules/ai/src/ui-message-stream/read-ui-message-stream.ts` — readUIMessageStream implementation
- `node_modules/ai/src/ui/default-chat-transport.ts` — DefaultChatTransport using parseJsonEventStream
- `node_modules/ai/src/ui/chat-transport.ts` — ChatTransport interface
- `node_modules/@ai-sdk/provider-utils/src/parse-json-event-stream.ts` — parseJsonEventStream internals
- `node_modules/@workflow/ai/dist/workflow-chat-transport.js` — WorkflowChatTransport with reconnection
- `node_modules/ai/docs/04-ai-sdk-ui/24-reading-ui-message-streams.mdx` — Official docs
- `node_modules/ai/docs/04-ai-sdk-ui/21-transport.mdx` — Transport documentation
- `src/hooks/use-game.ts` — Existing project usage of parseJsonEventStream (no useChat)
- `src/hooks/use-persona-chat.ts` — Existing React-based transport usage
- `src/workflows/hooks/game-event.ts` — Hook schema definition
- `src/workflows/tools/add-event.ts` — Tool pattern example
- `pixijs-vAI-bridge.md` — Bridge specification document

---

## Follow-on Questions

1. Should the PIXIJS bridge maintain its own `UIMessage[]` array (like useChat does internally) for conversation context, or delegate that to the server/workflow?
2. How should the bridge handle the `presentDialogChoices` flow — does PIXIJS block waiting for a user selection, or does the conversation pause server-side via a workflow hook?
3. Should custom data chunks (`data-workflow` type) be used for additional game state syncing alongside tool outputs, or should everything flow through tools?

---

## Clarifying Questions

- None — all research questions have been answered from source code.
