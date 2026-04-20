<!-- markdownlint-disable-file -->
# Implementation Details: Narrative Bridge (AI SDK ↔ Game Engine)

## Context Reference

Sources: specs/research/2026-04-20/pixijs-ai-bridge-research.md, specs/research/subagents/2026-04-20/ai-sdk-streaming-bridge.md

## Implementation Phase 1: Schema and Tool Changes (Backend)

<!-- parallelizable: true -->

### Step 1.1: Add clueSchema and update gameStateSchema with clues array

Add a structured clue schema to `game-state.ts` and include a `clues` array in the public `GameState`.

Files:
* src/workflows/schemas/game-state.ts - Add clueSchema, update gameStateSchema

Add after `gameEventSchema` (after line 22):

```ts
export const clueSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  relatedNpcIds: z.array(z.string()),
  discoveredAt: z.number(),
  discoveredFrom: z.string(),
});

export type Clue = z.infer<typeof clueSchema>;
```

Update `gameStateSchema` (line 33) to add `clues`:

```ts
export const gameStateSchema = z.object({
  gameId: z.string(),
  scenario: scenarioSchema,
  personas: z.array(personaSchema),
  events: z.array(gameEventSchema),
  clues: z.array(clueSchema),
  status: z.enum(["active", "solved", "failed"]),
});
```

Success criteria:
* `clueSchema` exports and validates test data
* `GameState` type includes `clues: Clue[]`

Context references:
* src/workflows/schemas/game-state.ts (Lines 1-70) - Current schema

Dependencies:
* None

### Step 1.2: Update play-game.ts to initialize clues array in GameState

Add `clues: []` to the initial GameState construction in `play-game.ts`. Without this, the build breaks because `gameStateSchema` requires `clues` after Step 1.1.

Files:
* src/workflows/play-game.ts - Add `clues: []` to initial state (line 164, after `events: []`)

Change the initial state construction (around line 153-167):

```ts
public: {
  gameId,
  scenario: { ... },
  personas,
  events: [],
  clues: [],       // <-- ADD THIS LINE
  status: "active",
},
```

Success criteria:
* Initial GameState includes `clues: []`
* No TypeScript errors in play-game.ts

Context references:
* src/workflows/play-game.ts (Lines 153-167) - Initial state construction

Dependencies:
* Step 1.1 completion (clueSchema added to gameStateSchema)

### Step 1.3: Create setNpcMood tool

Create a tool that allows the persona agent to explicitly update its visible mood. Follows existing `add-event.ts` closure-based factory pattern.

Files:
* src/workflows/tools/set-npc-mood.ts - New tool file

```ts
import { z } from "zod";

export function createSetNpcMoodTool(
  personaId: string,
  onMoodUpdate: (personaId: string, mood: string, intensity?: number) => void,
) {
  return {
    description: "Update your visible mood that the detective can observe. Use when your emotional state changes during conversation.",
    parameters: z.object({
      mood: z.string().describe("New mood: nervous, calm, defensive, suspicious, angry, relieved, etc."),
      intensity: z.number().min(1).max(10).optional().describe("How strongly this mood shows, 1-10"),
    }),
    execute: async ({ mood, intensity }: { mood: string; intensity?: number }) => {
      onMoodUpdate(personaId, mood, intensity);
      return { success: true, mood, intensity };
    },
  };
}
```

Success criteria:
* Tool exports factory function matching existing tool pattern
* Returns structured output with mood and intensity for client consumption

Context references:
* src/workflows/tools/add-event.ts (Lines 1-60) - Existing tool pattern

Dependencies:
* None

### Step 1.4: Create addClue tool

Create a tool that allows the persona agent to reveal a clue. The clue is added to game state's `clues` array and the client receives the tool output.

Files:
* src/workflows/tools/add-clue.ts - New tool file

```ts
import { z } from "zod";
import type { Clue } from "../schemas/game-state";

export function createAddClueTool(
  personaId: string,
  personaName: string,
  onClueDiscovered: (clue: Clue) => void,
) {
  return {
    description: "Reveal a clue to the detective based on what you've shared in conversation. Use when you've told the detective something important that constitutes evidence or a lead.",
    parameters: z.object({
      title: z.string().describe("Short clue title, e.g. 'Broken Watch'"),
      description: z.string().describe("What the detective learns from this clue"),
      relatedNpcIds: z.array(z.string()).describe("IDs of NPCs this clue relates to"),
    }),
    execute: async ({ title, description, relatedNpcIds }: { title: string; description: string; relatedNpcIds: string[] }) => {
      const clue: Clue = {
        id: `clue-${Date.now()}`,
        title,
        description,
        relatedNpcIds,
        discoveredAt: Date.now(),
        discoveredFrom: personaId,
      };
      onClueDiscovered(clue);
      return { success: true, clue };
    },
  };
}
```

Success criteria:
* Tool creates a Clue object with all required schema fields
* Tool output includes the full clue object for client consumption

Context references:
* specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 259-274) - addClue tool contract

Dependencies:
* Step 1.1 completion (clueSchema and Clue type)

### Step 1.5: Create presentDialogChoices tool

Create a tool that presents dialogue options. Player's selection comes back as a follow-up chat message (no workflow pause).

Files:
* src/workflows/tools/present-dialog-choices.ts - New tool file

```ts
import { z } from "zod";

export function createPresentDialogChoicesTool() {
  return {
    description: "Present the detective with specific dialogue options to choose from. Use when the conversation reaches a natural branching point.",
    parameters: z.object({
      prompt: z.string().describe("Context for why these choices are being offered"),
      choices: z.array(z.object({
        id: z.string(),
        label: z.string().describe("The text shown to the player"),
      })).min(2).max(5),
    }),
    execute: async ({ prompt, choices }: { prompt: string; choices: { id: string; label: string }[] }) => {
      return { presented: true, prompt, choices };
    },
  };
}
```

Success criteria:
* Returns choices array in output for client rendering
* No workflow pause mechanism introduced

Context references:
* specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 275-295) - presentDialogChoices contract

Dependencies:
* None

### Step 1.6: Register new tools in personaChatWorkflow

Add the three new tools to the persona agent's tool set in `persona-chat.ts`.

Files:
* src/workflows/persona-chat.ts - Import new tool factories and add to tools object (around lines 107-138)

Import the new factories:

```ts
import { createSetNpcMoodTool } from "./tools/set-npc-mood";
import { createAddClueTool } from "./tools/add-clue";
import { createPresentDialogChoicesTool } from "./tools/present-dialog-choices";
```

Add to the `tools` object (after `add_event` tool, around line 137):

```ts
const tools = {
  get_current_state: createGetCurrentStateTool( ... ),
  add_event: createAddEventTool( ... ),
  set_npc_mood: createSetNpcMoodTool(
    input.personaId,
    (personaId, mood) => {
      currentGameState = {
        ...currentGameState,
        personas: currentGameState.personas.map((p) =>
          p.id === personaId ? { ...p, mood } : p,
        ),
      };
      input.onGameStateUpdate(currentGameState);
    },
  ),
  add_clue: createAddClueTool(
    input.personaId,
    input.personaName,
    (clue) => {
      currentGameState = {
        ...currentGameState,
        clues: [...(currentGameState.clues ?? []), clue],
      };
      input.onGameStateUpdate(currentGameState);
    },
  ),
  present_dialog_choices: createPresentDialogChoicesTool(),
};
```

Success criteria:
* Persona agent has 5 tools: get_current_state, add_event, set_npc_mood, add_clue, present_dialog_choices
* Mood and clue callbacks correctly mutate currentGameState
* No TypeScript errors

Context references:
* src/workflows/persona-chat.ts (Lines 107-138) - Current tools object

Dependencies:
* Steps 1.1-1.5 completion

### Step 1.7: Validate backend changes

Validation commands:
* `npm run lint` - Full project lint
* `npm run build` - Next.js build to check types
* `npm test` - Run all tests

## Implementation Phase 2: NarrativeBridge Client Library

<!-- parallelizable: true -->

### Step 2.1: Create NarrativeBridge class in src/lib/narrative-bridge.ts

The NarrativeBridge is the central adapter between the game engine and the AI SDK streaming backend. It wraps `parseJsonEventStream` and `uiMessageChunkSchema` to consume SSE streams, tracks tool call IDs to route directives by tool name, and exposes an event-callback interface.

Files:
* src/lib/narrative-bridge.ts - New file

```ts
import { parseJsonEventStream, uiMessageChunkSchema, type UIMessageChunk } from 'ai';

export type DirectiveHandler = (toolName: string, output: unknown) => void;
export type TextDeltaHandler = (delta: string) => void;
export type TextCompleteHandler = (fullText: string) => void;
export type InteractionCompleteHandler = () => void;
export type ErrorHandler = (error: string) => void;

export interface NarrativeBridgeConfig {
  gameId: string;
  onTextDelta: TextDeltaHandler;
  onTextComplete: TextCompleteHandler;
  onDirective: DirectiveHandler;
  onInteractionComplete: InteractionCompleteHandler;
  onError?: ErrorHandler;
}

export class NarrativeBridge {
  private activeToolCalls = new Map<string, { toolName: string }>();
  private config: NarrativeBridgeConfig;
  private abortController: AbortController | null = null;
  private accumulatedText = '';

  constructor(config: NarrativeBridgeConfig) {
    this.config = config;
  }

  async startInteraction(personaId: string, message: string): Promise<void> {
    this.abortController = new AbortController();
    this.accumulatedText = '';
    this.activeToolCalls.clear();

    const response = await fetch(`/api/agent/${personaId}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: this.config.gameId,
        messages: [{ role: 'user', content: message }],
        trigger: 'submit-message',
      }),
      signal: this.abortController.signal,
    });

    if (!response.ok || !response.body) {
      this.config.onError?.(`Failed to start interaction: ${response.status}`);
      return;
    }

    await this.consumeStream(response.body);
  }

  async sendMessage(personaId: string, message: string, runId: string): Promise<void> {
    this.accumulatedText = '';
    this.activeToolCalls.clear();

    const response = await fetch(`/api/agent/${personaId}/stream/${runId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: this.config.gameId,
        message,
      }),
    });

    if (!response.ok || !response.body) {
      this.config.onError?.(`Failed to send message: ${response.status}`);
      return;
    }

    await this.consumeStream(response.body);
  }

  async submitAccusation(personaId: string): Promise<void> {
    const response = await fetch(`/api/run/${this.config.gameId}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'accuse', personaId }),
    });

    if (!response.ok) {
      this.config.onError?.(`Failed to submit accusation: ${response.status}`);
    }
  }

  cancelCurrentInteraction(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  private async consumeStream(stream: ReadableStream<Uint8Array>): Promise<void> {
    const chunkStream = parseJsonEventStream({
      stream,
      schema: uiMessageChunkSchema,
    });
    const reader = chunkStream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value.success) continue;
        this.handleChunk(value.value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  private handleChunk(chunk: UIMessageChunk): void {
    switch (chunk.type) {
      case 'text-delta':
        this.accumulatedText += chunk.delta;
        this.config.onTextDelta(chunk.delta);
        break;
      case 'text-end':
        this.config.onTextComplete(this.accumulatedText);
        break;
      case 'tool-input-start':
        this.activeToolCalls.set(chunk.toolCallId, { toolName: chunk.toolName });
        break;
      case 'tool-output-available':
        const info = this.activeToolCalls.get(chunk.toolCallId);
        if (info) {
          this.config.onDirective(info.toolName, chunk.output);
        }
        break;
      case 'finish':
        this.config.onInteractionComplete();
        break;
      case 'error':
        this.config.onError?.(chunk.errorText);
        break;
    }
  }
}
```

Discrepancy references:
* DD-01: Uses raw parseJsonEventStream instead of WorkflowChatTransport — simpler MVP, reconnection deferred to WI-06

Success criteria:
* NarrativeBridge class exports with full TypeScript types
* `startInteraction` posts to `/api/agent/{personaId}/stream` and consumes SSE stream
* `sendMessage` posts follow-up messages to `/api/agent/{personaId}/stream/{runId}`
* `submitAccusation` posts to `/api/run/{gameId}/event`
* `onTextDelta` fires for each text-delta chunk
* `onDirective` fires with correct toolName for tool-output-available chunks
* `onInteractionComplete` fires on finish chunk
* AbortController cancellation works

Context references:
* specs/research/subagents/2026-04-20/ai-sdk-streaming-bridge.md (Lines 1-90) - parseJsonEventStream API
* specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 340-425) - NarrativeBridge design
* src/hooks/use-game.ts (Lines 1-187) - Existing parseJsonEventStream usage pattern

Dependencies:
* None (uses existing ai package exports)

### Step 2.2: Create useNarrativeBridge React hook

Wrap the NarrativeBridge class lifecycle in a React hook. Manages bridge instance, dialogue state, and directive dispatch. This hook becomes the primary interface between React state and the streaming bridge.

Files:
* src/hooks/use-narrative-bridge.ts - New file

The hook manages:
- NarrativeBridge instance creation with gameId
- Dialogue state: current text (`dialogueText`), `isStreaming`, `choices` array
- Active `personaId` tracking for the current conversation
- Directive dispatch: mood updates via `set_npc_mood` forwarded to caller, clue additions via `add_clue` forwarded to caller, choices via `present_dialog_choices` set in local state
- Interaction lifecycle: start → stream → complete → idle

```ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { NarrativeBridge } from '@/lib/narrative-bridge';

export interface DialogueState {
  isOpen: boolean;
  personaId: string | null;
  text: string;
  isStreaming: boolean;
  choices: { id: string; label: string }[] | null;
}

interface UseNarrativeBridgeOptions {
  gameId: string;
  onMoodUpdate: (personaId: string, mood: string) => void;
  onClueDiscovered: (clue: { id: string; title: string; description: string; relatedNpcIds: string[]; discoveredAt: number; discoveredFrom: string }) => void;
}

export interface NarrativeBridgeControls {
  dialogue: DialogueState;
  startInteraction: (personaId: string, message: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  selectChoice: (choiceId: string, choiceLabel: string) => Promise<void>;
  submitAccusation: (personaId: string) => Promise<void>;
  closeDialogue: () => void;
}
```

The hook:
1. Creates NarrativeBridge on mount, passing config callbacks
2. `onTextDelta` → appends to `dialogueText`, sets `isStreaming: true`
3. `onTextComplete` → sets `isStreaming: false`
4. `onDirective('set_npc_mood', output)` → calls `options.onMoodUpdate`
5. `onDirective('add_clue', output)` → calls `options.onClueDiscovered`
6. `onDirective('present_dialog_choices', output)` → sets `choices` in dialogue state
7. `onInteractionComplete` → sets `isStreaming: false`, clears choices
8. `startInteraction` → opens dialogue panel, resets text, calls bridge.startInteraction
9. `sendMessage` → appends player text to dialogue, calls bridge.sendMessage
10. `selectChoice` → clears choices, sends choice label as message
11. `closeDialogue` → resets dialogue state, calls bridge.cancelCurrentInteraction

Success criteria:
* Hook creates NarrativeBridge on mount with gameId
* Exposes `startInteraction`, `sendMessage`, `selectChoice`, `submitAccusation`, `closeDialogue`
* Manages dialogue state reactively (text, isStreaming, choices, personaId)
* Delegates mood and clue directives to caller-provided callbacks
* Cleans up bridge on unmount

Context references:
* src/lib/narrative-bridge.ts - NarrativeBridge class (Step 2.1)

Dependencies:
* Step 2.1 completion (NarrativeBridge class)

## Implementation Phase 3: Integration Wiring

<!-- parallelizable: false -->

### Step 3.1: Update use-game.ts hook to handle clue state

Modify the existing useGame hook to initialize the `clues` array in game state and handle clue updates from stream data.

Files:
* src/hooks/use-game.ts - Modify existing file

Changes:
- Initialize `clues: []` in the default GameState
- Parse clue data from `data-workflow` chunks if the backend emits clue state updates
- Expose clues in the returned state

Success criteria:
* GameState always includes a `clues` array (never undefined)
* Clue updates from the workflow stream are reflected in state

Context references:
* src/hooks/use-game.ts (Lines 1-187) - Current hook implementation

Dependencies:
* Step 1.1 completion (clueSchema in GameState)

### Step 3.2: Create game page wrapper that wires bridge to GameInterface props

Create a new component that serves as the integration point: it uses `useGame` for game lifecycle, `useNarrativeBridge` for dialogue/directives, and passes everything as props to `GameInterface`.

Files:
* src/components/game/game-page.tsx - New file

This component:
1. Calls `useGame()` to start the game and track game state
2. Calls `useNarrativeBridge({ gameId, onMoodUpdate, onClueDiscovered })` for bridge controls
3. Maps `useGame` state to GameInterface persona/clue props
4. Maps `useNarrativeBridge` dialogue state to GameInterface dialogue props
5. Wires callbacks:
   - `onInteract` → for NPC type, calls `bridgeControls.startInteraction(personaId, "Hello")`
   - `onInteract` → for clue type, opens clue description in dialogue
   - `onInteract` → for accusation type, handled internally
   - `onSendMessage` → calls `bridgeControls.sendMessage(message)`
   - `onSelectChoice` → calls `bridgeControls.selectChoice(id, label)`
   - `onAccuse` → calls `bridgeControls.submitAccusation(personaId)`
   - `onCloseDialogue` → calls `bridgeControls.closeDialogue()`

```tsx
"use client";

import { GameInterface } from './game-interface';
import { useGame } from '@/hooks/use-game';
import { useNarrativeBridge } from '@/hooks/use-narrative-bridge';

export function GamePage() {
  const game = useGame();

  const bridge = useNarrativeBridge({
    gameId: game.gameId,
    onMoodUpdate: (personaId, mood) => {
      // Update local persona mood state
    },
    onClueDiscovered: (clue) => {
      // Add clue to local state
    },
  });

  return (
    <GameInterface
      personas={game.state?.personas ?? []}
      clues={game.state?.clues ?? []}
      dialogueText={bridge.dialogue.text}
      dialogueIsStreaming={bridge.dialogue.isStreaming}
      dialogueChoices={bridge.dialogue.choices}
      dialoguePersonaId={bridge.dialogue.personaId}
      onInteract={(entity) => {
        if (entity.type === 'npc') {
          bridge.startInteraction(entity.id, "Hello, I have some questions for you.");
        }
      }}
      onSendMessage={(msg) => bridge.sendMessage(msg)}
      onSelectChoice={(id, label) => bridge.selectChoice(id, label)}
      onAccuse={(personaId) => bridge.submitAccusation(personaId)}
      onCloseDialogue={() => bridge.closeDialogue()}
    />
  );
}
```

Success criteria:
* GamePage connects useGame and useNarrativeBridge to GameInterface props
* NPC interaction triggers bridge dialogue flow
* Messages, choices, and accusations route through bridge
* Mood and clue updates propagate to game state display
* Clean separation: GamePage is the only file that imports both bridge and engine

Context references:
* src/components/game/game-interface.tsx - GameInterface props interface (from engine plan)
* src/hooks/use-game.ts - useGame hook
* src/hooks/use-narrative-bridge.ts - useNarrativeBridge hook (Step 2.2)

Dependencies:
* Phase 1 completion (backend tools and schemas)
* Phase 2 completion (NarrativeBridge + hook)
* Game Engine plan completion (GameInterface exists with callback props)

### Step 3.3: Update page.tsx to use the wired game page component

Replace the engine plan's stub props with the actual wired GamePage component.

Files:
* src/app/page.tsx - Modify existing file

```tsx
import dynamic from 'next/dynamic';

const GamePage = dynamic(
  () => import('@/components/game/game-page').then(mod => ({ default: mod.GamePage })),
  { ssr: false },
);

export default function Home() {
  return <GamePage />;
}
```

Success criteria:
* Page uses GamePage instead of bare GameInterface with stub props
* Full end-to-end flow works: start game → walk → interact → dialogue → accuse

Context references:
* src/app/page.tsx - Current page (will have engine plan's dynamic import)

Dependencies:
* Step 3.2 completion

## Implementation Phase 4: Validation

<!-- parallelizable: false -->

### Step 4.1: Run full project validation

Execute all validation commands for the project:
* `npm run lint` - ESLint across all files
* `npm run build` - Next.js production build (type checking + bundling)
* `npm test` - Vitest test suite

### Step 4.2: Fix minor validation issues

Iterate on lint errors, build warnings, and test failures. Apply fixes directly when corrections are straightforward and isolated.

### Step 4.3: Report blocking issues

When validation failures require changes beyond minor fixes:
* Document the issues and affected files.
* Provide the user with next steps.
* Recommend additional research and planning rather than inline fixes.

## Dependencies

* ai@^6.0.146 (existing)
* @workflow/ai@^4.1.0-beta.60 (existing)
* zod@^4.3.6 (existing)
* PIXIJS Game Engine plan completed (GameInterface component with callback props)

## Success Criteria

* Full end-to-end narrative loop: interact → stream dialogue → tool directives → UI updates
* Backend tools execute correctly and stream structured outputs
* NarrativeBridge dispatches text deltas and directives to correct handlers
* Clues persist in GameState across the session
* No TypeScript errors, lint passes, tests pass
