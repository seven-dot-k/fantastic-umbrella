---
applyTo: 'specs/changes/2026-04-20/pixijs-game-engine-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: PIXIJS Game Engine

## Overview

Build the 2D PIXIJS top-down game engine for the murder mystery using @pixi/react, including room rendering, WASD movement, NPC/clue/furniture entities, interaction zones, and DOM overlay UI shells (dialogue panel, HUD, accusation modal). This plan is purely the game engine — all UI components expose callback props for external integration. No AI SDK or backend changes.

## Objectives

### User Requirements

* Integrate PIXIJS as the game renderer inside the existing Next.js 16 / React 19 app — Source: UI-prompt.md
* Implement smooth WASD player movement with AABB collision against furniture — Source: UI-prompt.md
* Render NPCs at fixed positions with mood-colored placeholder sprites and name labels — Source: UI-prompt.md
* Render environmental clue objects with pulsing glow effect — Source: UI-prompt.md
* Show "E to interact" floating prompt when player is near an NPC, clue, or accusation point — Source: UI-prompt.md
* Build DOM overlay dialogue panel shell with text display area, choice buttons, and player input — Source: UI-prompt.md
* Build DOM overlay HUD panel with NPC list (name + mood) and clue inventory — Source: UI-prompt.md
* Build DOM overlay accusation modal with NPC selection grid — Source: UI-prompt.md

### Derived Objectives

* Create `MapLayout` client-only configuration for spatial placement of entities — Derived from: PIXIJS needs position data; backend has no spatial concept
* Create `InputManager` for keyboard state tracking (WASD + E) — Derived from: PIXIJS has no built-in keyboard handling
* Use `dynamic` import with `ssr: false` for the game canvas — Derived from: PIXIJS requires browser WebGL/WebGPU APIs unavailable during SSR
* All overlay components accept props/callbacks rather than importing bridge logic — Derived from: separation of engine and bridge into independent plans

## Context Summary

### Project Files

* src/app/page.tsx - Root page, renders GameInterface (5 lines, will be modified for dynamic import)
* src/components/game/game-interface.tsx - Current React game UI (will be rewritten as canvas + overlay shell)
* package.json - Dependencies: Next.js 16, React 19, Tailwind CSS 4

### References

* UI-prompt.md - Full game design spec: 2D top-down, WASD+E, NPCs, clues, accusation, HUD
* specs/research/2026-04-20/pixijs-ai-bridge-research.md - Primary research (architecture, layout, component structure)
* specs/research/subagents/2026-04-20/pixijs-nextjs-integration.md - PIXIJS + Next.js integration patterns, @pixi/react API

### Standards References

* .github/copilot-instructions.md — TypeScript 5.x strict mode, Next.js conventions

## Implementation Checklist

### [ ] Implementation Phase 1: Package Installation and Configuration

<!-- parallelizable: true -->

* [ ] Step 1.1: Install pixi.js and @pixi/react packages
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 1.1)
* [ ] Step 1.2: Create PixiJS TypeScript declarations for @pixi/react JSX elements
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 1.2)

### [ ] Implementation Phase 2: Client Libraries (Input, Config, Hooks)

<!-- parallelizable: true -->

* [ ] Step 2.1: Create InputManager class for keyboard state (WASD + E)
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 2.1)
* [ ] Step 2.2: Create MapLayout game configuration with spatial types and utilities
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 2.2)
* [ ] Step 2.3: Create useKeyboard React hook
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 2.3)

### [ ] Implementation Phase 3: PIXIJS Game Components

<!-- parallelizable: false -->
<!-- Depends on Phase 1 (packages) and Phase 2 (input/config) -->

* [ ] Step 3.1: Create PixiCanvas wrapper component with @pixi/react Application
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 3.1)
* [ ] Step 3.2: Create GameWorld component (room background + entity container)
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 3.2)
* [ ] Step 3.3: Create Player component with WASD movement and collision
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 3.3)
* [ ] Step 3.4: Create NPC component with mood-colored placeholder and name label
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 3.4)
* [ ] Step 3.5: Create ClueObject component with pulsing glow effect
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 3.5)
* [ ] Step 3.6: Create InteractionPrompt component ("E to interact" floating text)
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 3.6)

### [ ] Implementation Phase 4: DOM Overlay UI Shells

<!-- parallelizable: true -->
<!-- Pure React/Tailwind components, no pixi.js imports — can run alongside Phases 2 and 3 -->

* [ ] Step 4.1: Create DialoguePanel overlay shell (text area, choice buttons, input field)
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 4.1)
* [ ] Step 4.2: Create HudPanel overlay shell (NPC list with moods, clue inventory)
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 4.2)
* [ ] Step 4.3: Create AccusationModal overlay shell (NPC selection grid)
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 4.3)

### [ ] Implementation Phase 5: Game Shell Integration

<!-- parallelizable: false -->
<!-- Depends on Phases 3 and 4 -->

* [ ] Step 5.1: Rewrite game-interface.tsx as React shell combining PIXIJS canvas + DOM overlays
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 5.1)
* [ ] Step 5.2: Update page.tsx with dynamic import (SSR disabled)
  * Details: specs/details/2026-04-20/pixijs-game-engine-details.md (Step 5.2)

### [ ] Implementation Phase 6: Validation

<!-- parallelizable: false -->

* [ ] Step 6.1: Run full project validation
  * Execute `npm run lint`
  * Execute `npm run build`
  * Execute `npm test`
* [ ] Step 6.2: Fix minor validation issues
  * Iterate on lint errors and build warnings
  * Apply fixes directly when corrections are straightforward
* [ ] Step 6.3: Report blocking issues
  * Document issues requiring additional research
  * Provide user with next steps and recommended planning

## Planning Log

See specs/plans/logs/2026-04-20/pixijs-game-engine-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* pixi.js@^8.18.1 — 2D WebGL/WebGPU renderer
* @pixi/react@^8.0.5 — React reconciler for PIXIJS v8
* No backend/AI SDK changes required (engine-only plan)
* Placeholder sprites via Graphics draw calls (no external assets required)

## Success Criteria

* PIXIJS canvas renders inside Next.js app without SSR errors — Traces to: dynamic import requirement
* Player character moves with WASD at 60fps with collision against furniture — Traces to: UI-prompt.md movement requirement
* NPCs render at MapLayout positions with mood-colored placeholders — Traces to: UI-prompt.md NPC rendering
* Clue objects render with pulsing glow effect — Traces to: UI-prompt.md clue visibility
* "E to interact" prompt appears when player is near interactable entities — Traces to: UI-prompt.md interaction prompt
* DOM overlay shells render correctly layered over canvas — Traces to: UI-prompt.md dialogue/HUD/accusation UI
* All overlays accept callback props (no direct bridge imports) — Traces to: plan separation requirement
* Project passes lint, build, and test — Traces to: validation phase
