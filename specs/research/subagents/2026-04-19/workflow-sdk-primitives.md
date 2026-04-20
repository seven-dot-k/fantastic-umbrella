# Workflow SDK Primitives Research

## Research Topics

1. Workflow state management — can a workflow expose arbitrary state externally?
2. Multiple DurableAgents in one workflow
3. Hooks: defineHook, hook.create({ token }), hook.resume(token, data), multiple simultaneous hooks
4. Workflow events/signals beyond hooks
5. getWritable and multiple streams (namespaces)
6. getRun API — what does the Run object expose?

---

## 1. Workflow State Management

### Question

Can a workflow store and expose arbitrary state (like game state) readable externally via an API? Patterns like `getWorkflowState`, `setState`, or state snapshots.

### Findings

**No built-in `setState`/`getWorkflowState` API exists.** The Workflow SDK does not provide a first-class mechanism for storing arbitrary workflow state that can be queried externally. The documented `workflow` package exports are:

- `getWorkflowMetadata()` — returns `{ workflowRunId, workflowStartedAt }` only
- `getStepMetadata()` — step execution context only
- `getWritable()` — writable stream for output
- `sleep()`, `createHook()`, `defineHook()`, `createWebhook()`, `fetch()`, `FatalError`, `RetryableError`

The `getRun()` API from `workflow/api` exposes:
- `runId`, `status`, `returnValue`, `readable`, `getReadable()`, `exists`, `workflowName`, `createdAt`, `startedAt`, `completedAt`, `wakeUp()`, `cancel()`

**No `getState()` or similar method on the Run object.**

### Workaround Patterns

1. **Stream-based state**: Write game state as custom `data-*` chunks to the writable stream. External consumers can read the stream via `getRun(id).getReadable()` and reconstruct state from the data parts. This is the pattern used in the existing codebase for `data-product-content`, `data-category-content`, and `data-workflow` markers.

2. **Return value**: `run.returnValue` blocks until workflow completion — not useful for in-progress state.

3. **External database**: The workflow can persist state to an external database in step functions, and external APIs can query it directly. This is the most flexible approach for real-time game state queries.

4. **World SDK**: The `workflow/api` package exposes `getWorld()` — a low-level API for inspecting runs, steps, events, hooks, streams, and queues. This could potentially be used to inspect the event log, but it is a low-level API not documented for arbitrary state storage.

### Evidence

- `workflow` package API reference: https://workflow-sdk.dev/docs/api-reference/workflow
- `getRun()` API reference: https://workflow-sdk.dev/docs/api-reference/workflow-api/get-run
- Existing workspace usage in `src/workflows/catalog-agent.ts` line 75: `const { workflowRunId: runId, workflowStartedAt } = getWorkflowMetadata();`

---

## 2. Multiple DurableAgents in One Workflow

### Question

Can you create multiple `DurableAgent` instances within a single workflow function?

### Findings

**Yes.** `DurableAgent` is a plain class instantiated with `new DurableAgent({...})`. There is no documented limitation on creating multiple instances. The agent's `stream()` method accepts a `writable` parameter explicitly, and the same writable can be shared across agents or different writables can be used.

The key constraints:
- Each `agent.stream()` call is an async operation that writes to the provided `writable`
- Multiple agents can share the same `writable` stream (all output interleaves on the same stream)
- Each agent manages its own message history independently (the `messages` array passed to `stream()`)
- Each agent can have different `model`, `tools`, `instructions`, `temperature`, etc.

### Code Pattern for Multiple Agents

```typescript
export async function multiAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const detectiveAgent = new DurableAgent({
    model: "anthropic/claude-sonnet-4-6",
    instructions: "You are Detective Noir...",
    tools: detectiveTools,
  });

  const suspectAgent = new DurableAgent({
    model: "anthropic/claude-haiku-4-5",
    instructions: "You are the suspicious butler...",
    tools: suspectTools,
  });

  // Sequential: detective asks, then suspect responds
  const detectiveResult = await detectiveAgent.stream({
    messages: [...],
    writable,
    preventClose: true,
    sendStart: true,
    sendFinish: false,
  });

  const suspectResult = await suspectAgent.stream({
    messages: [...],
    writable,
    preventClose: true,
    sendStart: false,
    sendFinish: false,
  });
}
```

### Important Notes

- `DurableAgent` does NOT maintain internal message state between `stream()` calls — you must pass accumulated `messages` each time
- The `stream()` result returns `{ messages, steps, toolCalls, toolResults }` — use `result.messages` to build up conversation history
- Use `preventClose: true` on all but the last `stream()` call to keep the writable open
- Use `sendStart: false` for subsequent agents writing to the same stream to avoid creating duplicate message IDs

### Evidence

- DurableAgent API: https://workflow-sdk.dev/docs/api-reference/workflow-ai/durable-agent
- Multi-turn example in the API docs shows calling `agent.stream()` multiple times with accumulated messages
- Workspace usage: `src/workflows/catalog-agent.ts` lines 107-113 — single agent, but `stream()` called in a loop with `preventClose: true`

---

## 3. Hooks: defineHook, create, resume, Multiple Simultaneous Hooks

### Question

How do `defineHook`, `hook.create({ token })`, and `hook.resume(token, data)` work? Can multiple hooks of the same type be active simultaneously with different tokens?

### Findings

#### `defineHook({ schema })`

Creates a reusable, type-safe hook definition with runtime validation via Standard Schema v1 (Zod, Valibot, etc.). Returns an object with `.create()` and `.resume()` methods. Defined at module level, outside any workflow.

```typescript
import { defineHook } from "workflow";
import { z } from "zod";

export const approvalHook = defineHook({
  schema: z.object({
    approved: z.boolean(),
    comment: z.string().optional(),
  }),
});
```

#### `hook.create({ token })`

Called inside a workflow function (NOT inside a step — hooks are workflow-level primitives). Creates a hook instance that the workflow can `await` on. Returns an object that is:
- **Thenable** (can be `await`ed for a single value)
- **AsyncIterable** (can be used with `for await...of` for multiple events)
- **Disposable** (supports `using` keyword for cleanup)

The `token` parameter:
- If omitted, a random token is generated
- Custom tokens enable deterministic resumption (external systems can reconstruct the token)
- Token must be unique — creating a hook with a token already in use causes a `HookConflictError`

```typescript
// Inside a workflow:
const hook = approvalHook.create({ token: toolCallId });
const { approved, comment } = await hook; // Suspends workflow
```

#### `hook.resume(token, data)`

Called from OUTSIDE the workflow (API routes, server actions, etc.). Sends data to the waiting hook, resuming the workflow.

```typescript
// In an API route:
await approvalHook.resume(toolCallId, { approved: true, comment: "LGTM" });
```

The lower-level alternative is `resumeHook(token, data)` from `workflow/api`.

#### Multiple Hooks of the Same Type — YES

**Multiple hooks of the same `defineHook` type can be active simultaneously with different tokens.** This is explicitly demonstrated in the workspace:

- `chatMessageHook` is created with `token: runId` in `catalog-agent.ts` line 117
- `contentApprovalHook` is created with `token: toolCallId` in `save-products.ts` line 47 and `save-categories.ts` line 47
- Both hooks can be awaited concurrently — the `chatMessageHook` is used for the main turn loop while `contentApprovalHook` instances are created per-tool-call for approval

The approval hook is created multiple times in a single workflow run — once per save tool invocation — each with a different `toolCallId` as the token. This proves multiple simultaneous instances work.

#### Receiving Multiple Events (AsyncIterable)

Hooks implement `AsyncIterable`, enabling `for await...of`:

```typescript
const hook = chatMessageHook.create({ token: runId });
for await (const { message } of hook) {
  if (message === "/done") break;
  messages.push({ role: "user", content: message });
  // process message...
}
```

This is what the existing codebase uses implicitly — calling `await hook` in a `while` loop (each `await` gets the next value).

#### Disposing Hooks

- `using hook = ...` auto-disposes when leaving scope
- `hook.dispose()` manually releases the token
- After disposal, the token can be reused by another workflow

### Evidence

- Hooks documentation: https://workflow-sdk.dev/docs/foundations/hooks
- defineHook API: https://workflow-sdk.dev/docs/api-reference/workflow/define-hook
- Human-in-the-loop guide: https://workflow-sdk.dev/docs/ai/human-in-the-loop
- Workspace: `src/workflows/hooks/approval.ts`, `src/workflows/hooks/chat-message.ts`
- Workspace: `src/workflows/tools/save-products.ts` line 47 — `contentApprovalHook.create({ token: toolCallId })`
- Workspace: `src/workflows/catalog-agent.ts` line 117 — `chatMessageHook.create({ token: runId })`

---

## 4. Workflow Events/Signals Beyond Hooks

### Question

Is there a pattern for sending events/signals to a running workflow beyond hooks? Something like `workflow.sendEvent()` or similar.

### Findings

**Hooks ARE the primary mechanism for sending signals/events to running workflows.** There is no separate `sendEvent()` or `sendSignal()` API. The Workflow SDK uses hooks as its universal event/signal primitive.

Available mechanisms for external-to-workflow communication:

1. **Hooks** (`createHook` / `defineHook`) — The primary mechanism. Supports both single events and event streams via `AsyncIterable`.

2. **Webhooks** (`createWebhook`) — Higher-level abstraction on top of hooks that provides auto-generated URLs and HTTP request/response handling. Automatically wired at `/.well-known/workflow/v1/webhook/:token`.

3. **`run.wakeUp()`** — Interrupts pending `sleep()` calls, optionally targeting specific correlation IDs. Not a general-purpose event mechanism.

4. **`run.cancel()`** — Cancels the workflow run entirely.

5. **Multiplayer Chat Sessions** — The docs explicitly describe using hooks for system events, external services, and multiple users injecting messages into the same workflow:
   ```typescript
   await chatMessageHook.resume(runId, {
     message: `[System] Flight ${flightNumber} status updated: ${newStatus}`,
   });
   ```

**There is no `workflow.sendEvent()`, no signal queue, and no pub/sub mechanism beyond hooks.**

For a game workflow, the hook-based `for await...of` pattern is the correct approach for receiving player actions, game events, and timed triggers.

### Evidence

- Hooks docs: https://workflow-sdk.dev/docs/foundations/hooks
- Multiplayer chat sessions: https://workflow-sdk.dev/docs/ai/chat-session-modeling#multiplayer-chat-sessions
- getRun API: https://workflow-sdk.dev/docs/api-reference/workflow-api/get-run — only exposes `wakeUp()` and `cancel()`
- workflow/api exports: `start`, `getRun`, `resumeHook`, `resumeWebhook`, `getHookByToken`, `getWorld`

---

## 5. `getWritable` and Multiple Streams

### Question

Can a single workflow manage multiple writable streams, or is there only one per workflow run?

### Findings

**Yes — multiple streams are supported via namespaces.** The `getWritable()` function accepts an optional `options` parameter with a `namespace` field:

```typescript
const defaultWritable = getWritable();                        // Default stream
const logsWritable = getWritable({ namespace: "logs" });      // Named stream
const gameStateWritable = getWritable({ namespace: "state" }); // Another named stream
```

Similarly, `getRun().getReadable()` accepts a `namespace` option:

```typescript
const run = getRun(id);
const defaultStream = run.getReadable();                         // Default stream
const logsStream = run.getReadable({ namespace: "logs" });       // Named stream
const stateStream = run.getReadable({ namespace: "state" });     // Named stream
```

### Key Points

- `getWritable()` can be called from both workflow and step functions
- In workflow context: can obtain the handle but cannot call `getWriter()`, `write()`, or `close()` directly — must pass to steps
- In step context: can call `getWritable()` directly and interact fully (write, close)
- The same stream reference is returned for the same namespace within a workflow run
- Each namespace has its own independent stream with its own `startIndex` for resumption

### Game Application

This is powerful for a game workflow:
- Default stream: UI message chunks (chat/narrative)
- `"game-state"` namespace: periodic game state snapshots
- `"events"` namespace: game event log

### Evidence

- getWritable API with namespace example: https://workflow-sdk.dev/docs/api-reference/workflow/get-writable
- The "Using Namespaced Streams in Steps" example explicitly demonstrates this pattern
- getRun `getReadable` options include `namespace?: string`

---

## 6. `getRun` API

### Question

What methods does a Run object expose? Can you get state from it?

### Findings

The `getRun(runId)` function from `workflow/api` returns a `Run` object with:

| Property/Method | Type | Description |
|---|---|---|
| `runId` | `string` | The workflow run ID |
| `status` | `Promise<"pending" \| "running" \| "completed" \| "failed" \| "cancelled">` | Current status |
| `returnValue` | `Promise<TResult>` | Final return value (blocks until completion) |
| `exists` | `Promise<boolean>` | Whether the run exists |
| `workflowName` | `Promise<string>` | Name of the workflow |
| `createdAt` | `Promise<Date>` | When the run was created |
| `startedAt` | `Promise<Date \| undefined>` | When execution started |
| `completedAt` | `Promise<Date \| undefined>` | When execution completed |
| `readable` | `WorkflowReadableStream` | Default readable stream (shorthand for `getReadable()`) |
| `getReadable(options?)` | `(options?) => WorkflowReadableStream` | Get readable stream with options (namespace, startIndex) |
| `wakeUp(options?)` | `(options?) => Promise<StopSleepResult>` | Interrupt pending `sleep()` calls |
| `cancel()` | `() => Promise<void>` | Cancel the workflow run |

### `WorkflowReadableStream`

Extends standard `ReadableStream` with:
- `getTailIndex()` — returns index of last chunk (0-based), or `-1` if empty

### `getReadable` Options

```typescript
interface WorkflowReadableStreamOptions {
  namespace?: string;   // Distinguish between multiple streams
  startIndex?: number;  // Starting chunk index (negative = from end)
  ops?: Promise<any>[]; // Async ops for waitUntil() pattern
  global?: Record<string, any>; // Global object for type hydration
}
```

### Can You Get State?

**No arbitrary state getter.** But you can:
1. Read the stream (`getReadable()`) for custom data parts that encode state
2. Check `status` for lifecycle state
3. Use `returnValue` for final result (blocks until completion)

### Workspace Usage

- `src/app/api/chat/[id]/stream/route.ts` — uses `getRun(id)` and `run.getReadable({ startIndex })` for stream reconnection
- `src/app/api/chat/route.ts` — uses `run.runId` and `run.readable` from `start()`

### Evidence

- getRun API: https://workflow-sdk.dev/docs/api-reference/workflow-api/get-run
- Starting Workflows: https://workflow-sdk.dev/docs/foundations/starting-workflows

---

## Additional Discoveries

### `workflow/internal/errors`

The workspace imports `HookNotFoundError` and `HookConflictError` from `workflow/internal/errors` for error handling in API routes. Both have a static `.is(error)` method for type-checking.

### `"use workflow"` and `"use step"` Directives

- `"use workflow"` — marks a function as a workflow entry point. Runs in sandboxed environment without full Node.js access. Must be deterministic.
- `"use step"` — marks a function as a step. Full Node.js runtime access. Auto-retried on failure (up to 3x by default).
- Hook `.create()` must be called from workflow context (NOT from steps)
- `getWritable()` in workflow context returns handle but cannot interact; in step context, full interaction

### `getWorkflowMetadata()`

Returns `{ workflowRunId: string, workflowStartedAt: Date }` — minimal metadata about the current run.

### `WorkflowChatTransport` (from `@workflow/ai`)

Client-side transport for AI SDK's `useChat` that handles:
- Automatic stream reconnection on interruption
- `onChatSendMessage` callback for capturing run ID from response headers
- `onChatEnd` callback for cleanup
- `prepareReconnectToStreamRequest` for building reconnection URLs
- `maxConsecutiveErrors` for controlling retry behavior

---

## Clarifying Questions

1. For a multi-agent game: is the intent to have each character agent speaking on the **same stream** (interleaved narrative) or **separate streams** (one per character, composited on the client)?

2. Game state query pattern: is real-time polling of game state needed (favors external DB or namespaced stream), or is it acceptable to reconstruct from the event stream?

---

## Follow-On Questions (Discovered During Research)

1. **World SDK** (`getWorld()` from `workflow/api`) — described as "low-level API for inspecting runs, steps, events, hooks, streams, and queues." Could potentially be used for richer state introspection. Documentation at https://workflow-sdk.dev/docs/api-reference/workflow-api/world.

2. **`getHookByToken()`** from `workflow/api` — "Get hook details and metadata by its token." Could be useful for checking if a player's hook is active before sending events.

3. **Message queueing** — referenced at https://workflow-sdk.dev/docs/ai/message-queueing — may be relevant for queueing player actions while agents are processing.
