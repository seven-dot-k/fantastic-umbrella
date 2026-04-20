<!-- markdownlint-disable-file -->
# Task Research: PIXIJS ↔ Vercel AI SDK Bridge

Research what changes are needed to transform the current text-based murder mystery game into a 2D PIXIJS game with a narrative bridge to the existing Vercel AI SDK backend.

## Task Implementation Requests

* Review the rough draft bridge spec (`pixijs-vAI-bridge.md`) and identify gaps, missing details, and decisions needed
* Research PIXIJS integration into the existing Next.js 15 / React 19 codebase
* Research how to consume Vercel AI SDK streams from PIXIJS (non-React context)
* Determine what backend changes are needed (new tools, schema changes, API routes)
* Identify the right architecture for the NarrativeBridge adapter layer

## Scope and Success Criteria

* Scope: Full analysis of the bridge between PIXIJS game client and Vercel AI SDK workflow backend. Covers client transport, new tools, schema changes, and UI architecture. Excludes: actual PIXIJS game art/sprites creation, detailed level design, sound.
* Assumptions:
  * The existing workflow backend (play-game, persona-chat) stays largely intact
  * PIXIJS replaces the React-based chat UI but React still hosts the Next.js app shell
  * The game is a single-room 2D top-down experience per the UI-prompt spec
  * Durable workflows + hooks remain the event-passing mechanism
* Success Criteria:
  * Clear understanding of every component that needs to change
  * Selected architecture for the NarrativeBridge class
  * Complete tool contract for game directives
  * Identified gaps in the draft bridge spec with proposed solutions

## Outline

1. Bridge Spec Review — gaps and completions needed
2. Architecture — PIXIJS client ↔ backend ownership boundaries
3. Transport Layer — how PIXIJS consumes AI SDK streams
4. Tool Contract — complete set of tools for game directives
5. Schema Changes — new types for clues, interaction zones, map data
6. API Route Changes — what stays, what changes
7. Client Architecture — React shell + PIXIJS canvas + DOM overlays
8. Implementation Alternatives — evaluated approaches

## Research Executed

### File Analysis

* `src/workflows/play-game.ts` (lines 1-350)
  * Main game workflow: generates scenario → personas → secrets → enters event loop
  * Event loop handles: `get-state`, `add-event`, `update-mood`, `chat-message`, `accuse`, `end-game`, `end-persona-chat`
  * Chat messages trigger child `personaChatWorkflow` via direct await
  * Uses namespaced writables: default stream, `game-state`, `secret-state`, per-persona `persona-{id}`

* `src/workflows/persona-chat.ts` (lines 1-100)
  * Uses `DurableAgent` from `@workflow/ai/agent`
  * System prompt includes character description, alibi, secrets, and murderer-specific instructions
  * Tools: `get_current_state` and `add_event`
  * Returns `newMessages` and `updatedGameState` to parent

* `src/workflows/schemas/game-state.ts` (lines 1-78)
  * Public: `GameState` (gameId, scenario, personas[], events[], status)
  * Persona: id, name, age, occupation, relationship, description, mood, sanity
  * Secret: murdererId, motive, weapon, opportunity, personaSecrets{}
  * No clue schema exists yet (clues only in scenario prompt, not structured)

* `src/workflows/schemas/scenario.ts` (lines 1-100)
  * Step schemas for generation: scenario → personas → secrets
  * `scenarioStepSchema` includes `clues: z.array(z.string())` but these are prompt-only, never stored in game state

* `src/workflows/hooks/game-event.ts` (lines 1-14)
  * Single hook with flat discriminated union: `accuse | end-game | get-state | add-event | update-mood | chat-message | end-persona-chat`
  * Optional fields: personaId, description, mood, sanityDelta, message

* `src/workflows/tools/add-event.ts` (lines 1-60)
  * Closure-based tool: captures personaId, personaName, onEvent callback
  * Input: description, newMood?, sanityDelta?
  * Mutates game state via callback

* `src/workflows/tools/get-current-state.ts` (lines 1-50)
  * Returns persona's mood, sanity, and last 10 events

* `src/app/api/run/route.ts` — POST starts playGameWorkflow, returns UIMessageStreamResponse
* `src/app/api/run/[gameId]/event/route.ts` — POST sends game events (accuse, end-game)
* `src/app/api/run/[gameId]/state/route.ts` — GET reads latest game state from namespaced stream
* `src/app/api/agent/[agentId]/stream/route.ts` — POST starts/continues persona chat
* `src/app/api/agent/[agentId]/stream/[runId]/route.ts` — GET reconnects, POST sends follow-up

* `src/hooks/use-game.ts` (lines 1-100)
  * Already uses `parseJsonEventStream` + `uiMessageChunkSchema` directly (not useChat)
  * Handles `data-workflow` chunks for status messages and game state

* `src/hooks/use-persona-chat.ts` (lines 1-100)
  * Uses `useChat` + `WorkflowChatTransport` for React-based persona conversations
  * Will be replaced by NarrativeBridge for PIXIJS

* `src/components/game/game-interface.tsx` — React UI with sidebar, persona list, chat panel
  * Will be replaced by PIXIJS canvas + DOM overlays

### External Research

* npm registry + pixi-react GitHub
  * `pixi.js@8.18.1` — latest stable, WebGL/WebGPU renderer
  * `@pixi/react@8.0.5` — official React reconciler, React 19 + Next.js 15 compatible
  * `@pixi/tilemap@5.0.2` — tilemap support for PixiJS v8
  * Source: subagent doc `pixijs-nextjs-integration.md`

* AI SDK source code: `node_modules/ai/src/ui-message-stream/`
  * Full UIMessageChunk discriminated union documented
  * `parseJsonEventStream` works in browser without React
  * `readUIMessageStream` assembles chunks into UIMessage objects
  * Source: subagent doc `ai-sdk-streaming-bridge.md`

### Project Conventions

* TypeScript 5.x strict mode, Next.js 15 App Router
* AI SDK v6 with `@workflow/ai` DurableAgent
* Zod v3.24+ for schema validation
* Workflow SDK for durable execution with hooks

## Key Discoveries

### 1. Bridge Spec Gaps — What's Missing or Incomplete

The draft `pixijs-vAI-bridge.md` has the right high-level architecture but is missing critical implementation details:

**Section 6 (AI → Game Response Model): Completely empty.** This is the most important section. The response model is actually well-defined by the AI SDK's `UIMessageChunk` system — streamed text deltas for dialogue plus tool call outputs for structured directives. The spec should document the concrete chunk types PIXIJS will handle.

**Section 7 (Game Directives): Empty.** The tool list in Section 8 partially covers this. Game directives should be defined as the set of side-effects that tool outputs trigger in the PIXIJS client (mood change, clue discovered, choices presented, accusation result).

**Section 9 (Transport Shape): Empty.** The existing API routes already define the transport. PIXIJS will POST to `/api/agent/{personaId}/stream` for conversations and `/api/run/{gameId}/event` for game actions. The response is an SSE stream of `UIMessageChunk` objects.

**Missing: Clue System Architecture.** The bridge spec mentions `addClue` tool but the current game has no structured clue system. Clues exist only as prompt text in `scenarioStepSchema.clues`. A full clue schema, discovery tracking, and clue inspection flow need to be designed.

**Missing: Interaction Zone Model.** The bridge spec says "PIXIJS owns interaction zones" but doesn't define how the game knows where NPCs and clues are positioned. The backend generates personas and clues but has no concept of spatial positioning — that's purely client-side.

**Missing: Game Initialization Flow.** How does the PIXIJS game get the initial scenario, persona list, and map data after starting a game? Currently `useGame` streams this from `/api/run`. The PIXIJS client needs the same data to place NPCs on the map.

**Missing: Dialogue Flow State Machine.** The spec says "presentDialogChoices" but doesn't define the blocking/continuation model. When the LLM presents choices, does the workflow pause waiting for user input (via hook), or does the PIXIJS client just send the selection as a follow-up message?

**Missing: `showDialogue` clarification.** The spec says this is "implicit through text stream" but the PIXIJS dialogue window needs explicit open/close signals. When does the dialogue box appear? When does it dismiss? Need lifecycle events.

### 2. Current Backend is 90% Reusable

The existing workflow architecture maps cleanly to the PIXIJS bridge:

| Current System | PIXIJS Bridge Equivalent |
|---|---|
| `gameEventHook.resume(gameId, event)` | Same — API routes already abstract this |
| `personaChatWorkflow` streaming to `persona-{id}` writable | Same — PIXIJS reads the same stream |
| `writeGameState()` to namespaced stream | Same — PIXIJS polls or subscribes to game state |
| `add_event` tool | Same — used by persona during dialogue |
| `get_current_state` tool | Same — used by persona during dialogue |
| React `useChat` + `WorkflowChatTransport` | Replaced by `NarrativeBridge` class |
| React components (sidebar, chat panel) | Replaced by PIXIJS canvas + DOM overlays |

**New tools needed on the backend:**
* `setNpcMood` — explicit mood directive (currently implicit in `add_event`)
* `addClue` — structured clue discovery
* `presentDialogChoices` — present options to the player

**Schema additions needed:**
* `ClueSchema` — id, title, description, relatedNpcIds, position (client-side)
* `InteractionZone` — type (npc/clue/accusation), entityId, bounds (client-only)
* `MapLayout` — NPC positions, clue positions, furniture positions (client-only config)

### 3. Transport Layer — Clear Winner

Three options were evaluated for how PIXIJS consumes AI SDK streams:

| Option | Description | Reconnection | Complexity |
|---|---|---|---|
| A. Raw `fetch` + `parseJsonEventStream` | Direct stream consumption | Manual | Low |
| B. `WorkflowChatTransport` without React | Use transport class directly | Built-in | Medium |
| C. `NarrativeBridge` wrapping transport | Event-emitter adapter pattern | Built-in | Medium |

**Selected: Option C — NarrativeBridge wrapping WorkflowChatTransport.**

Rationale:
* `WorkflowChatTransport` provides auto-reconnection for durable workflows (critical for long game sessions)
* The `NarrativeBridge` adapter provides a clean interface between imperative PIXIJS code and the stream protocol
* Event-emitter pattern (`onTextDelta`, `onDirective`, `onInteractionComplete`) maps naturally to game engine callbacks
* The bridge class can maintain tool call tracking (`toolCallId → toolName` map) to route directives

### 4. PIXIJS Integration Architecture

**Selected: @pixi/react v8 with DOM overlays.**

The PIXIJS canvas handles world rendering (room, player movement, NPCs, clues, interaction zones). React DOM overlays handle text-heavy UI (dialogue panel, HUD sidebar, clue inventory, accusation UI). This split is natural because:

* PIXIJS excels at sprite rendering, movement, and spatial interaction
* React DOM excels at text rendering, scrolling, styled components
* Dialogue text (streamed from LLM) renders better in DOM with proper typography
* HUD elements (persona list, mood indicators) are already built as React components

Layout:
```
┌─────────────────────────────────────────────┐
│  Relative container (full screen)           │
│ ┌─────────────────────────────────────────┐ │
│ │  PIXIJS Canvas (z-0)                    │ │
│ │  - Room background sprite               │ │
│ │  - Player character                     │ │
│ │  - NPCs with interaction zones          │ │
│ │  - Clue objects with glow effects       │ │
│ │  - "E to interact" prompts              │ │
│ └─────────────────────────────────────────┘ │
│ ┌──────┐                                    │
│ │ HUD  │  DOM overlay (z-20, left side)     │
│ │ Panel│  - NPC list with moods             │
│ │      │  - Clue inventory                  │
│ └──────┘                                    │
│ ┌─────────────────────────────────────────┐ │
│ │ Dialogue Panel  DOM overlay (z-10)      │ │
│ │ - NPC portrait + name                   │ │
│ │ - Streamed dialogue text                │ │
│ │ - Choice buttons when presented         │ │
│ │ - Input for player messages             │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Accusation UI  DOM overlay (z-30)       │ │
│ │ - Suspect selection grid                │ │
│ │ - Confirm button                        │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 5. Complete Tool Contract for Game Directives

Beyond the current `add_event` and `get_current_state`, the persona agent needs:

```ts
// New tool: setNpcMood
{
  description: "Update your visible mood that the detective can observe",
  inputSchema: z.object({
    mood: z.string().describe("New mood: nervous, calm, defensive, suspicious, angry, etc."),
    intensity: z.number().min(1).max(10).optional().describe("How strongly this mood shows"),
  }),
  execute: async ({ mood, intensity }) => {
    // Mutates persona.mood in game state
    // Client receives via tool-output-available → updates HUD + NPC sprite animation
    return { success: true, mood };
  }
}

// New tool: addClue
{
  description: "Reveal a clue to the detective based on what you've told them",
  inputSchema: z.object({
    clueId: z.string(),
    title: z.string().describe("Short clue title"),
    description: z.string().describe("What the detective learns"),
    relatedNpcIds: z.array(z.string()),
  }),
  execute: async (input) => {
    // Adds clue to game state
    // Client receives via tool-output-available → updates clue inventory + triggers discovery animation
    return { success: true, clue: input };
  }
}

// New tool: presentDialogChoices
{
  description: "Present the detective with specific dialogue options to choose from",
  inputSchema: z.object({
    prompt: z.string().describe("Context for why these choices are being offered"),
    choices: z.array(z.object({
      id: z.string(),
      label: z.string(),
    })),
  }),
  execute: async (input) => {
    // Client receives choices via tool-output-available → renders choice buttons
    // Player's selection sent as next chat message
    return { presented: true, choices: input.choices };
  }
}
```

**Decision: `presentDialogChoices` does NOT pause the workflow.** Instead:
1. LLM calls tool and returns choices to client
2. Client renders choice buttons in the dialogue panel
3. Player clicks a choice
4. Choice text sent as a new `chat-message` event
5. Persona agent sees the choice as a normal user message and continues

This avoids adding a new hook/pause mechanism and uses the existing `chat-message` flow.

### 6. UIMessageChunk Types PIXIJS Must Handle

Based on AI SDK source (`node_modules/ai/src/ui-message-stream/ui-message-chunks.ts`):

| Chunk Type | PIXIJS Handler |
|---|---|
| `text-start` | Open/prepare dialogue text area |
| `text-delta` | Append text to dialogue (typewriter effect) |
| `text-end` | Mark dialogue text as complete |
| `tool-input-start` | Track `toolCallId → toolName` mapping |
| `tool-output-available` | Dispatch game directive based on `toolName` |
| `tool-output-error` | Show error state / log |
| `data-workflow` | Handle `game-state`, `status`, `user-message` custom data |
| `finish` | Mark interaction turn as complete |
| `error` | Show error to player |
| `start` | Begin new assistant message |

### 7. Schema Changes Needed

```ts
// New: Clue tracking in game state
export const clueSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  relatedNpcIds: z.array(z.string()),
  discoveredAt: z.number(), // timestamp
  discoveredFrom: z.string(), // personaId or "environment"
});

// Updated GameState — add clues array
export const gameStateSchema = z.object({
  gameId: z.string(),
  scenario: scenarioSchema,
  personas: z.array(personaSchema),
  events: z.array(gameEventSchema),
  clues: z.array(clueSchema), // NEW
  status: z.enum(["active", "solved", "failed"]),
});

// Client-only: Map layout (not in workflow, just PIXIJS config)
interface MapLayout {
  background: string; // sprite path
  npcs: { personaId: string; x: number; y: number; interactionRadius: number }[];
  clues: { clueId: string; x: number; y: number; sprite: string; interactionRadius: number }[];
  furniture: { id: string; x: number; y: number; sprite: string; collision: AABB }[];
  accusationPoint: { x: number; y: number; interactionRadius: number };
  playerSpawn: { x: number; y: number };
}
```

## Technical Scenarios

### Scenario A: Full @pixi/react Declarative Approach

The entire game scene is described as React components using @pixi/react's reconciler. Game state drives component re-renders.

**Requirements:**

* @pixi/react v8.0.5 with `extend()` pattern
* React state management for player position, NPC states, interaction zones
* `useTick` for game loop (movement, collision checks)
* DOM overlays for dialogue and HUD

**Preferred Approach:**

* Recommended for this project due to simpler developer experience and tight React integration
* The game is relatively simple (single room, ~6 NPCs, ~3 clues) — reconciler overhead is negligible

```text
src/
  components/
    game/
      pixi-canvas.tsx          — <Application> wrapper with extend()
      game-world.tsx           — Room background + entity container
      player.tsx               — Player sprite + movement via useTick
      npc.tsx                  — NPC sprite + interaction zone
      clue-object.tsx          — Clue sprite + glow effect
      interaction-prompt.tsx   — "E to interact" floating text
    overlay/
      dialogue-panel.tsx       — DOM overlay for streamed dialogue
      hud-panel.tsx            — DOM overlay for NPC moods + clues
      accusation-modal.tsx     — DOM overlay for accusation flow
  lib/
    narrative-bridge.ts        — NarrativeBridge class (transport wrapper)
    game-config.ts             — MapLayout, entity positions, collision boxes
    input-manager.ts           — Keyboard state (WASD + E)
  hooks/
    use-game.ts                — Existing (minor updates for clues)
    use-narrative-bridge.ts    — React hook wrapping NarrativeBridge lifecycle
    use-keyboard.ts            — Keyboard state hook
    use-player-movement.ts     — Movement + collision logic
```

```mermaid
graph TD
  A[Player presses E near NPC] -->|PIXIJS detects proximity| B[Game dispatches interaction-start]
  B -->|NarrativeBridge.startInteraction| C[POST /api/agent/{personaId}/stream]
  C -->|SSE Stream| D[NarrativeBridge processes chunks]
  D -->|text-delta| E[Dialogue Panel renders typewriter text]
  D -->|tool-output: setNpcMood| F[HUD updates mood indicator]
  D -->|tool-output: addClue| G[Clue inventory + discovery animation]
  D -->|tool-output: presentDialogChoices| H[Dialogue Panel shows choice buttons]
  H -->|Player clicks choice| I[NarrativeBridge.sendChoice]
  I -->|POST follow-up message| C
  D -->|finish| J[Dialogue Panel shows input for next question]
  J -->|Player types message| K[NarrativeBridge.sendMessage]
  K -->|POST follow-up message| C
```

**Implementation Details:**

The `NarrativeBridge` class is the central adapter:

```ts
import { parseJsonEventStream, uiMessageChunkSchema, type UIMessageChunk } from 'ai';
import { WorkflowChatTransport } from '@workflow/ai';

type DirectiveHandler = (toolName: string, output: unknown) => void;
type TextDeltaHandler = (delta: string) => void;
type InteractionCompleteHandler = (conversationId: string) => void;

interface NarrativeBridgeConfig {
  gameId: string;
  onTextDelta: TextDeltaHandler;
  onDirective: DirectiveHandler;
  onInteractionComplete: InteractionCompleteHandler;
  onError?: (error: string) => void;
}

class NarrativeBridge {
  private activeToolCalls = new Map<string, { toolName: string }>();
  private config: NarrativeBridgeConfig;
  private abortController: AbortController | null = null;

  constructor(config: NarrativeBridgeConfig) {
    this.config = config;
  }

  async startInteraction(personaId: string): Promise<void> {
    this.abortController = new AbortController();
    const response = await fetch(`/api/agent/${personaId}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: this.config.gameId }),
      signal: this.abortController.signal,
    });
    await this.consumeStream(response.body!);
  }

  async sendMessage(personaId: string, message: string): Promise<void> {
    const gameId = this.config.gameId;
    const runId = gameId; // in current arch, runId === gameId
    const response = await fetch(`/api/agent/${personaId}/stream/${runId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, message }),
    });
    await this.consumeStream(response.body!);
  }

  async submitAccusation(personaId: string): Promise<void> {
    await fetch(`/api/run/${this.config.gameId}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'accuse', personaId }),
    });
  }

  cancelCurrentInteraction(): void {
    this.abortController?.abort();
  }

  private async consumeStream(stream: ReadableStream<Uint8Array>) {
    const chunkStream = parseJsonEventStream({
      stream,
      schema: uiMessageChunkSchema,
    });
    const reader = chunkStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value.success) continue;
      this.handleChunk(value.value);
    }
  }

  private handleChunk(chunk: UIMessageChunk) {
    switch (chunk.type) {
      case 'text-delta':
        this.config.onTextDelta(chunk.delta);
        break;
      case 'tool-input-start':
        this.activeToolCalls.set(chunk.toolCallId, { toolName: chunk.toolName });
        break;
      case 'tool-output-available':
        const info = this.activeToolCalls.get(chunk.toolCallId);
        if (info) this.config.onDirective(info.toolName, chunk.output);
        break;
      case 'finish':
        this.config.onInteractionComplete('done');
        break;
      case 'error':
        this.config.onError?.(chunk.errorText);
        break;
    }
  }
}
```

#### Considered Alternatives

**Scenario B: Raw PixiJS with useRef/useEffect (no @pixi/react)**

Imperative game loop driven by `requestAnimationFrame` or `app.ticker`. Game state managed in plain objects, not React state.

* Pros: Full control, no reconciler overhead, familiar to game developers
* Cons: Manual cleanup, manual React context bridging, more boilerplate for entity management
* Rejection reason: The game is simple enough that @pixi/react's declarative approach is cleaner. The reconciler overhead is negligible for ~10 entities.

**Scenario C: Separate PIXIJS app outside React**

Run PIXIJS in a separate script/iframe, communicating with the Next.js app via postMessage or shared state.

* Pros: Complete isolation, no React lifecycle concerns
* Cons: Complex communication layer, no shared state, harder to develop/debug, overkill for this project
* Rejection reason: Introduces unnecessary complexity without benefits for a single-page game.

## Potential Next Research

* Sprite/art pipeline: What tools to use for creating cute pixel-art sprites (Aseprite, Piskel) and how to export as spritesheets
  * Reasoning: The UI-prompt specifies "cute pixel-art aesthetic" — need actual art assets
  * Reference: UI-prompt.md

* AnimatedSprite patterns for idle/walk animations
  * Reasoning: NPCs need idle bobbing, player needs walk cycle
  * Reference: PIXIJS docs for AnimatedSprite

* Camera/viewport: Whether `pixi-viewport` is needed for a single-room game
  * Reasoning: If the room is larger than screen, need scrolling camera following player
  * Reference: pixi-viewport npm package

* Performance profiling @pixi/react reconciler with game tick loop
  * Reasoning: Ensure 60fps maintained with streaming text + entity updates
  * Reference: @pixi/react issue #602

## Implementation Roadmap (Recommended Order)

### Phase 1: Foundation (NarrativeBridge + PIXIJS Shell)
1. Install `pixi.js`, `@pixi/react` packages
2. Create `NarrativeBridge` class in `src/lib/narrative-bridge.ts`
3. Create PIXIJS canvas wrapper component with `"use client"` + `dynamic` import
4. Create basic game layout: canvas + DOM overlay containers
5. Wire up `NarrativeBridge` to existing API routes (verify streaming works)

### Phase 2: Game World
6. Create room background sprite
7. Implement player character with WASD movement + AABB collision
8. Place NPC sprites at fixed positions
9. Implement interaction zone detection (proximity check)
10. Show "E to interact" floating prompt

### Phase 3: Bridge Integration
11. Wire E-key interaction → `NarrativeBridge.startInteraction()`
12. Build dialogue panel DOM overlay (consume `onTextDelta` for typewriter)
13. Handle `onDirective` dispatch for tool outputs (mood, clue, choices)
14. Build choice selection UI in dialogue panel
15. Wire follow-up messages through `NarrativeBridge.sendMessage()`

### Phase 4: Backend Enhancements
16. Add `setNpcMood` tool to persona-chat workflow
17. Add `addClue` tool with structured clue schema
18. Add `presentDialogChoices` tool
19. Add `clues` array to `GameState` schema
20. Generate map layout config from scenario (NPC positions, clue positions)

### Phase 5: Polish
21. Build HUD panel DOM overlay (NPC list + moods + clue inventory)
22. Build accusation flow UI
23. Implement clue object sprites with glow/sparkle effects
24. Add NPC idle animations
25. Add player walk animation

## Complete File Reference Map

| File | Status | Purpose |
|---|---|---|
| `src/lib/narrative-bridge.ts` | NEW | NarrativeBridge adapter class |
| `src/lib/game-config.ts` | NEW | MapLayout, entity positions |
| `src/lib/input-manager.ts` | NEW | Keyboard state management |
| `src/hooks/use-narrative-bridge.ts` | NEW | React hook for NarrativeBridge lifecycle |
| `src/hooks/use-keyboard.ts` | NEW | Keyboard state hook |
| `src/hooks/use-game.ts` | MODIFY | Add clue state handling |
| `src/components/game/pixi-canvas.tsx` | NEW | @pixi/react Application wrapper |
| `src/components/game/game-world.tsx` | NEW | Room + entities |
| `src/components/game/player.tsx` | NEW | Player sprite + movement |
| `src/components/game/npc.tsx` | NEW | NPC sprite + interaction zone |
| `src/components/game/clue-object.tsx` | NEW | Clue sprite + effects |
| `src/components/game/interaction-prompt.tsx` | NEW | "E to interact" prompt |
| `src/components/game/game-interface.tsx` | REWRITE | React shell: canvas + DOM overlays |
| `src/components/overlay/dialogue-panel.tsx` | NEW | DOM dialogue overlay |
| `src/components/overlay/hud-panel.tsx` | NEW | DOM HUD overlay |
| `src/components/overlay/accusation-modal.tsx` | NEW | DOM accusation overlay |
| `src/workflows/schemas/game-state.ts` | MODIFY | Add clueSchema, update gameStateSchema |
| `src/workflows/persona-chat.ts` | MODIFY | Add new tools: setNpcMood, addClue, presentDialogChoices |
| `src/workflows/tools/set-npc-mood.ts` | NEW | setNpcMood tool |
| `src/workflows/tools/add-clue.ts` | NEW | addClue tool |
| `src/workflows/tools/present-dialog-choices.ts` | NEW | presentDialogChoices tool |
| `src/app/page.tsx` | MODIFY | Dynamic import of new game interface |
| `package.json` | MODIFY | Add pixi.js, @pixi/react |
| `src/hooks/use-persona-chat.ts` | REMOVE/ARCHIVE | Replaced by NarrativeBridge |
| `src/components/chat/*` | REMOVE/ARCHIVE | Replaced by overlay/dialogue-panel |
| `src/components/game/persona-card.tsx` | REMOVE/ARCHIVE | Replaced by overlay/hud-panel |
| `src/components/game/persona-chat-panel.tsx` | REMOVE/ARCHIVE | Replaced by overlay/dialogue-panel |
