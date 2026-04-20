---
applyTo: 'specs/changes/2026-04-20/narrative-bridge-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Narrative Bridge (AI SDK ↔ Game Engine)

## Overview

Build the NarrativeBridge adapter that connects the PIXIJS game engine to the Vercel AI SDK workflow backend. Includes backend schema/tool changes, the NarrativeBridge streaming class, React hook integration, and wiring into the game engine's callback props. Depends on the PIXIJS Game Engine plan being implemented first.

## Objectives

### User Requirements

* Build NarrativeBridge adapter to consume AI SDK SSE streams and dispatch text deltas + tool-based directives to the game UI — Source: pixijs-vAI-bridge.md
* Implement streaming dialogue text from LLM into the DOM overlay dialogue panel — Source: UI-prompt.md, pixijs-vAI-bridge.md
* Add structured clue system with discovery tracking persisted in GameState — Source: UI-prompt.md
* Add new backend tools: `setNpcMood`, `addClue`, `presentDialogChoices` for the persona agent — Source: specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 241-288)
* Wire accusation mechanic through NarrativeBridge to existing API route — Source: UI-prompt.md

### Derived Objectives

* Add `clueSchema` and `clues` array to `GameState` — Derived from: clue system needs persistent state; current schema has no clue support (game-state.ts lines 1-70)
* Initialize `clues: []` in play-game.ts initial state construction — Derived from: adding required `clues` field to schema would break existing state creation (play-game.ts line 164)
* Update `use-game.ts` hook to handle clue state from workflow stream — Derived from: clues must propagate from backend to client
* Create page-level wiring component that connects NarrativeBridge outputs to GameInterface callback props — Derived from: game engine uses callback props; bridge owns the implementations

## Context Summary

### Project Files

* src/workflows/play-game.ts - Main game workflow, creates initial GameState at line 153 (439 lines)
* src/workflows/persona-chat.ts - DurableAgent persona handler, tools defined at lines 107-138 (192 lines)
* src/workflows/schemas/game-state.ts - Public/secret schemas, no clue schema (70 lines)
* src/workflows/hooks/game-event.ts - Hook definition for game events (18 lines)
* src/workflows/tools/add-event.ts - Existing tool: closure-based factory pattern
* src/workflows/tools/get-current-state.ts - Existing tool: returns persona state
* src/hooks/use-game.ts - Game state management via parseJsonEventStream (187 lines)
* src/hooks/use-persona-chat.ts - React useChat + WorkflowChatTransport (to be replaced by NarrativeBridge)
* src/app/page.tsx - Root page with dynamic import (updated by engine plan, will be modified again)
* src/components/game/game-interface.tsx - Callback-prop-based game shell (created by engine plan)

### References

* pixijs-vAI-bridge.md - Draft bridge spec defining ownership boundaries and event protocol
* specs/research/2026-04-20/pixijs-ai-bridge-research.md - Primary research document
* specs/research/subagents/2026-04-20/ai-sdk-streaming-bridge.md - AI SDK streaming research (parseJsonEventStream, UIMessageChunk types)
* specs/research/subagents/2026-04-19/workflow-sdk-primitives.md - Workflow SDK primitives (hooks, DurableAgent, writables)

### Standards References

* .github/copilot-instructions.md — TypeScript 5.x strict mode, AI SDK conventions

### Prerequisite Plans

* specs/plans/2026-04-20/pixijs-game-engine-plan.instructions.md — PIXIJS Game Engine must be implemented first. This plan depends on the GameInterface component's callback prop interface.

## Implementation Checklist

### [ ] Implementation Phase 1: Schema and Tool Changes (Backend)

<!-- parallelizable: true -->

* [ ] Step 1.1: Add clueSchema and update gameStateSchema with clues array
  * Details: specs/details/2026-04-20/narrative-bridge-details.md (Step 1.1)
* [ ] Step 1.2: Update play-game.ts to initialize clues array in GameState
  * Details: specs/details/2026-04-20/narrative-bridge-details.md (Step 1.2)
* [ ] Step 1.3: Create setNpcMood tool
  * Details: specs/details/2026-04-20/narrative-bridge-details.md (Step 1.3)
* [ ] Step 1.4: Create addClue tool
  * Details: specs/details/2026-04-20/narrative-bridge-details.md (Step 1.4)
* [ ] Step 1.5: Create presentDialogChoices tool
  * Details: specs/details/2026-04-20/narrative-bridge-details.md (Step 1.5)
* [ ] Step 1.6: Register new tools in personaChatWorkflow
  * Details: specs/details/2026-04-20/narrative-bridge-details.md (Step 1.6)
* [ ] Step 1.7: Validate backend changes
  * Run `npm run lint` and `npm run build`
  * Run `npm test`

### [ ] Implementation Phase 2: NarrativeBridge Client Library

<!-- parallelizable: true -->

* [ ] Step 2.1: Create NarrativeBridge class in src/lib/narrative-bridge.ts
  * Details: specs/details/2026-04-20/narrative-bridge-details.md (Step 2.1)
* [ ] Step 2.2: Create useNarrativeBridge React hook
  * Details: specs/details/2026-04-20/narrative-bridge-details.md (Step 2.2)

### [ ] Implementation Phase 3: Integration Wiring

<!-- parallelizable: false -->
<!-- Depends on Phases 1 and 2, plus the Game Engine plan being complete -->

* [ ] Step 3.1: Update use-game.ts hook to handle clue state
  * Details: specs/details/2026-04-20/narrative-bridge-details.md (Step 3.1)
* [ ] Step 3.2: Create game page wrapper that wires bridge to GameInterface props
  * Details: specs/details/2026-04-20/narrative-bridge-details.md (Step 3.2)
* [ ] Step 3.3: Update page.tsx to use the wired game page component
  * Details: specs/details/2026-04-20/narrative-bridge-details.md (Step 3.3)

### [ ] Implementation Phase 4: Validation

<!-- parallelizable: false -->

* [ ] Step 4.1: Run full project validation
  * Execute `npm run lint`
  * Execute `npm run build`
  * Execute `npm test`
* [ ] Step 4.2: Fix minor validation issues
  * Iterate on lint errors and build warnings
  * Apply fixes directly when corrections are straightforward
* [ ] Step 4.3: Report blocking issues
  * Document issues requiring additional research
  * Provide user with next steps and recommended planning

## Planning Log

See specs/plans/logs/2026-04-20/narrative-bridge-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* ai@^6.0.146 (existing) — parseJsonEventStream, uiMessageChunkSchema for NarrativeBridge
* @workflow/ai@^4.1.0-beta.60 (existing) — DurableAgent for persona-chat tools
* zod@^4.3.6 (existing) — Schema validation for clueSchema and tool parameters
* **Prerequisite**: PIXIJS Game Engine plan completed (GameInterface with callback props exists)

## Success Criteria

* NarrativeBridge class consumes AI SDK SSE streams and dispatches text deltas + tool directives — Traces to: pixijs-vAI-bridge.md streaming requirement
* Streaming dialogue text displays in the dialogue panel via bridge callbacks — Traces to: UI-prompt.md dialogue requirement
* `setNpcMood` tool output dispatches to HUD mood update — Traces to: UI-prompt.md HUD mood requirement
* `addClue` tool output adds clue to GameState and updates HUD inventory — Traces to: UI-prompt.md clue system
* `presentDialogChoices` tool output renders choice buttons in dialogue panel — Traces to: research Key Discovery §5
* Accusation submitted via NarrativeBridge to `/api/run/{gameId}/event` — Traces to: UI-prompt.md accusation requirement
* `clues` array persists in GameState across the game session — Traces to: schema change requirement
* Full end-to-end flow works: interact with NPC → dialogue streams → tools fire → UI updates — Traces to: integration
* Project passes lint, build, and test — Traces to: validation phase
