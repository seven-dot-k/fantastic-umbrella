<!-- markdownlint-disable-file -->
# Implementation Details: PIXIJS Game Engine

## Context Reference

Sources: specs/research/2026-04-20/pixijs-ai-bridge-research.md, specs/research/subagents/2026-04-20/pixijs-nextjs-integration.md, UI-prompt.md

## Implementation Phase 1: Package Installation and Configuration

<!-- parallelizable: true -->

### Step 1.1: Install pixi.js and @pixi/react packages

Run `npm install pixi.js@^8.18.1 @pixi/react@^8.0.5` to add PIXIJS and the React reconciler.

Files:
* package.json - Add pixi.js and @pixi/react to dependencies

Success criteria:
* `npm install` completes without errors
* `pixi.js` and `@pixi/react` appear in package.json dependencies

Context references:
* specs/research/subagents/2026-04-20/pixijs-nextjs-integration.md (Lines 20-28) - Version info

Dependencies:
* None

### Step 1.2: Create PixiJS TypeScript declarations for @pixi/react JSX elements

Create a global type declaration file that registers PixiJS classes as JSX elements via @pixi/react's `UnprefixedPixiElements` or use the `pixi` prefix convention.

Files:
* src/pixi.d.ts - New TypeScript declaration file

Add the declaration:

```ts
import type { UnprefixedPixiElements } from '@pixi/react';

declare module '@pixi/react' {
  interface PixiElements extends UnprefixedPixiElements {}
}
```

Success criteria:
* TypeScript recognizes `<pixiContainer>`, `<pixiSprite>`, `<pixiGraphics>`, `<pixiText>` JSX elements without errors

Context references:
* specs/research/subagents/2026-04-20/pixijs-nextjs-integration.md (Lines 155-165) - @pixi/react extend pattern

Dependencies:
* Step 1.1 completion (packages installed)

## Implementation Phase 2: Client Libraries (Input, Config, Hooks)

<!-- parallelizable: true -->

### Step 2.1: Create InputManager class for keyboard state (WASD + E)

Create a simple keyboard state manager that tracks which keys are currently pressed. Used by the Player component's `useTick` callback for movement and interaction detection.

Files:
* src/lib/input-manager.ts - New file

```ts
export class InputManager {
  private keys = new Set<string>();
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;

  constructor() {
    this.onKeyDownBound = (e) => this.keys.add(e.key.toLowerCase());
    this.onKeyUpBound = (e) => this.keys.delete(e.key.toLowerCase());
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    this.keys.clear();
  }

  isPressed(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  consumePress(key: string): boolean {
    const wasPressed = this.keys.has(key.toLowerCase());
    if (wasPressed) this.keys.delete(key.toLowerCase());
    return wasPressed;
  }
}
```

Success criteria:
* Tracks pressed keys via DOM keydown/keyup events
* `isPressed('w')` returns true while W is held
* `consumePress('e')` returns true once then false (for single-press interaction)
* `detach()` removes listeners and clears state

Context references:
* specs/research/subagents/2026-04-20/pixijs-nextjs-integration.md (Lines 240-270) - Keyboard input pattern

Dependencies:
* None

### Step 2.2: Create MapLayout game configuration with spatial types and utilities

Define the client-only spatial configuration for the game world. This includes NPC positions, clue positions, furniture/collision boxes, the accusation point, and the player spawn. This data is purely client-side — the backend generates personas and clues textually; the client places them spatially.

Files:
* src/lib/game-config.ts - New file

```ts
export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NpcPlacement {
  personaId: string;
  x: number;
  y: number;
  interactionRadius: number;
}

export interface CluePlacement {
  clueId: string;
  x: number;
  y: number;
  interactionRadius: number;
}

export interface FurniturePlacement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapLayout {
  width: number;
  height: number;
  npcs: NpcPlacement[];
  clues: CluePlacement[];
  furniture: FurniturePlacement[];
  accusationPoint: { x: number; y: number; interactionRadius: number };
  playerSpawn: { x: number; y: number };
}

/** Generate a default map layout for the given persona IDs */
export function createDefaultMapLayout(personaIds: string[]): MapLayout {
  const width = 960;
  const height = 640;
  const centerX = width / 2;
  const centerY = height / 2;

  // Distribute NPCs in a circle around the room
  const npcRadius = 200;
  const npcs: NpcPlacement[] = personaIds.map((id, i) => {
    const angle = (i / personaIds.length) * Math.PI * 2 - Math.PI / 2;
    return {
      personaId: id,
      x: centerX + Math.cos(angle) * npcRadius,
      y: centerY + Math.sin(angle) * npcRadius,
      interactionRadius: 48,
    };
  });

  return {
    width,
    height,
    npcs,
    clues: [
      { clueId: 'env-clue-1', x: 120, y: 120, interactionRadius: 32 },
      { clueId: 'env-clue-2', x: width - 120, y: height - 120, interactionRadius: 32 },
    ],
    furniture: [
      { id: 'table-1', x: 100, y: 280, width: 80, height: 60 },
      { id: 'bookshelf-1', x: width - 100, y: 100, width: 60, height: 120 },
      { id: 'couch-1', x: 200, y: height - 100, width: 120, height: 50 },
    ],
    accusationPoint: { x: centerX, y: centerY, interactionRadius: 48 },
    playerSpawn: { x: centerX, y: height - 80 },
  };
}

/** Check if point is within interaction radius of a target */
export function isInRange(
  px: number, py: number,
  tx: number, ty: number,
  radius: number,
): boolean {
  const dx = px - tx;
  const dy = py - ty;
  return dx * dx + dy * dy <= radius * radius;
}

/** Check AABB collision */
export function checkAABBCollision(
  ax: number, ay: number, aWidth: number, aHeight: number,
  bx: number, by: number, bWidth: number, bHeight: number,
): boolean {
  return (
    ax < bx + bWidth &&
    ax + aWidth > bx &&
    ay < by + bHeight &&
    ay + aHeight > by
  );
}
```

Success criteria:
* MapLayout type exports with all spatial data structures
* `createDefaultMapLayout` distributes NPCs in a circle given persona IDs
* `isInRange` correctly checks proximity for interaction zones
* `checkAABBCollision` checks rectangular collision for furniture

Context references:
* specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 310-330) - MapLayout schema

Dependencies:
* None

### Step 2.3: Create useKeyboard React hook

Wrap the InputManager in a React hook that attaches/detaches keyboard listeners on mount/unmount.

Files:
* src/hooks/use-keyboard.ts - New file

```ts
import { useEffect, useRef } from 'react';
import { InputManager } from '@/lib/input-manager';

export function useKeyboard(): InputManager {
  const manager = useRef<InputManager>(new InputManager());

  useEffect(() => {
    manager.current.attach();
    return () => manager.current.detach();
  }, []);

  return manager.current;
}
```

Success criteria:
* Hook returns a stable InputManager instance
* Keyboard listeners attach on mount, detach on unmount

Context references:
* specs/research/subagents/2026-04-20/pixijs-nextjs-integration.md (Lines 240-270) - Keyboard hook pattern

Dependencies:
* Step 2.1 completion (InputManager class)

## Implementation Phase 3: PIXIJS Game Components

<!-- parallelizable: false -->

### Step 3.1: Create PixiCanvas wrapper component with @pixi/react Application

Create the root PIXIJS component that wraps `@pixi/react`'s `<Application>` with proper `"use client"` directive and `extend()` registration.

Files:
* src/components/game/pixi-canvas.tsx - New file

```tsx
"use client";

import { Application, extend } from '@pixi/react';
import { Container, Sprite, Graphics, Text } from 'pixi.js';
import { useRef, type ReactNode } from 'react';

extend({ Container, Sprite, Graphics, Text });

interface PixiCanvasProps {
  width: number;
  height: number;
  children: ReactNode;
}

export function PixiCanvas({ width, height, children }: PixiCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      style={{ width, height, position: 'relative' }}
    >
      <Application
        width={width}
        height={height}
        background="#1a1a2e"
      >
        {children}
      </Application>
    </div>
  );
}
```

Success criteria:
* Component renders a PIXIJS canvas at specified dimensions
* `extend()` registers Container, Sprite, Graphics, Text for JSX usage
* Component is marked `"use client"` for Next.js compatibility

Context references:
* specs/research/subagents/2026-04-20/pixijs-nextjs-integration.md (Lines 60-82) - Application wrapper pattern

Dependencies:
* Phase 1 completion (pixi.js, @pixi/react installed)

### Step 3.2: Create GameWorld component (room background + entity container)

Create the game world component that renders the room background and contains all game entities (player, NPCs, clues, interaction prompts) as children.

Files:
* src/components/game/game-world.tsx - New file

Renders:
- Background colored rectangle via `<pixiGraphics>` draw callback (dark room floor, e.g. `#2a1f3d`)
- Furniture rectangles as additional `<pixiGraphics>` elements (darker shading for collision boxes)
- Children passed through for entity rendering (Player, NPCs, ClueObjects, InteractionPrompt)

Props:
- `mapLayout: MapLayout` — room dimensions and furniture positions
- `children: ReactNode` — entity components

Success criteria:
* Renders a room-sized background rectangle
* Renders furniture as visible rectangles matching MapLayout positions
* Accepts children for entity rendering layered above background
* Uses pixiContainer for organizing layers

Context references:
* specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 296-310) - Game world layout

Dependencies:
* Step 3.1 completion (PixiCanvas wrapper)

### Step 3.3: Create Player component with WASD movement and collision

Create the player character component with WASD movement via `useTick`, AABB collision against furniture, and proximity detection for NPCs/clues/accusation point.

Files:
* src/components/game/player.tsx - New file

Key behaviors:
- Reads keyboard state from InputManager via `useTick` callback (memoized with `useCallback`)
- Moves at fixed speed (3px) scaled by `ticker.deltaTime`
- Checks AABB collision against furniture array before applying movement
- Scans NPC positions, clue positions, and accusation point for proximity
- Reports nearest interactable to parent via `onNearbyEntity` callback
- E key `consumePress` triggers `onInteract` callback with entity info

Props interface:
```tsx
interface PlayerProps {
  inputManager: InputManager;
  mapLayout: MapLayout;
  spawnX: number;
  spawnY: number;
  onNearbyEntity: (entity: { type: 'npc' | 'clue' | 'accusation'; id: string } | null) => void;
  onInteract: (entity: { type: 'npc' | 'clue' | 'accusation'; id: string }) => void;
}
```

Renders:
- Colored rectangle (Graphics draw) 24x24, bright color (e.g. `#4fc3f7`)

Player size: 24x24 AABB. Speed: 3 pixels per deltaTime unit.

Success criteria:
* Player moves with WASD at consistent speed regardless of frame rate
* Collision with furniture prevents movement into occupied space
* Proximity detection identifies nearest interactable within range
* E key press triggers onInteract callback with entity info
* Position tracked via useRef for per-frame mutation without re-renders

Context references:
* specs/research/subagents/2026-04-20/pixijs-nextjs-integration.md (Lines 240-285) - Movement and input pattern
* src/lib/game-config.ts - isInRange, checkAABBCollision utilities

Dependencies:
* Steps 2.1, 2.2, 3.1 completion

### Step 3.4: Create NPC component with mood-colored placeholder and name label

Create NPC sprite components rendered at fixed positions from the MapLayout. Each NPC displays as a colored circle (placeholder) with their name as text below. Color varies by mood.

Files:
* src/components/game/npc.tsx - New file

Props interface:
```tsx
interface NpcProps {
  x: number;
  y: number;
  name: string;
  mood: string;
}
```

Mood-to-color mapping:
- calm → `#4a90d9` (blue)
- nervous → `#f5d547` (yellow)
- defensive → `#e74c3c` (red)
- suspicious → `#e67e22` (orange)
- angry → `#c0392b` (dark red)
- relieved → `#2ecc71` (green)
- default → `#95a5a6` (gray)

Renders:
- Colored circle (Graphics draw) radius 16
- Text label below with persona name (fontSize 12, white fill)

Success criteria:
* NPC renders at the specified x,y position
* Name displays below the sprite
* Circle color updates when mood prop changes

Context references:
* specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 296-310) - Entity rendering

Dependencies:
* Step 3.1 completion (PixiCanvas with extend)

### Step 3.5: Create ClueObject component with pulsing glow effect

Create environmental clue objects rendered as small diamonds with a subtle pulsing glow effect using Graphics and useTick for animation.

Files:
* src/components/game/clue-object.tsx - New file

Props interface:
```tsx
interface ClueObjectProps {
  x: number;
  y: number;
}
```

Renders:
- Small diamond shape (Graphics draw, rotated square) ~12x12
- Golden/yellow color (`#f1c40f`)
- Pulsing alpha animation via useTick: `alpha = 0.5 + 0.5 * Math.sin(time * 0.05)`
- time incremented each tick

Success criteria:
* Clue renders at specified position
* Pulsing glow effect smoothly oscillates alpha between 0.5 and 1.0
* Visually distinct from NPCs (diamond shape, golden color)

Context references:
* UI-prompt.md - "Clues should visually stand out slightly (glow, sparkle, or outline)"

Dependencies:
* Step 3.1 completion (PixiCanvas with extend)

### Step 3.6: Create InteractionPrompt component ("E to interact" floating text)

Create a floating text prompt that appears above the nearest interactable entity when the player is within range.

Files:
* src/components/game/interaction-prompt.tsx - New file

Props interface:
```tsx
interface InteractionPromptProps {
  x: number;
  y: number;
  visible: boolean;
}
```

Renders:
- PixiJS Text "Press E" (fontSize 14, white fill, bold)
- Positioned above the target entity (y offset -30)
- Slight floating animation: `y += Math.sin(time * 0.08) * 2` via useTick
- Visibility controlled by `visible` prop (alpha 0 or 1)

Success criteria:
* Text appears when visible is true
* Text positioned above the provided coordinates
* Text has gentle bobbing animation
* Text disappears when visible is false

Context references:
* UI-prompt.md - "Show a floating prompt: 'E to interact'"

Dependencies:
* Step 3.1 completion (PixiCanvas with extend)

## Implementation Phase 4: DOM Overlay UI Shells

<!-- parallelizable: true -->

### Step 4.1: Create DialoguePanel overlay shell (text area, choice buttons, input field)

Create a React DOM overlay component positioned at the bottom of the game container. This is a **UI shell** — it renders based on props and fires callbacks, with no direct bridge/AI imports.

Files:
* src/components/overlay/dialogue-panel.tsx - New file

Props interface:
```tsx
interface DialoguePanelProps {
  isOpen: boolean;
  personaName: string | null;
  text: string;
  isStreaming: boolean;
  choices: { id: string; label: string }[] | null;
  onSendMessage: (message: string) => void;
  onSelectChoice: (choiceId: string, choiceLabel: string) => void;
  onClose: () => void;
}
```

Layout:
- Fixed at bottom of game container, full width, ~200px tall
- Top bar: NPC name + close button
- Middle: scrollable text area showing `text` prop (auto-scrolls on update)
- Bottom: choice buttons (when `choices` non-null) or text input + send button
- Styled as cozy RPG conversation window (dark semi-transparent bg, rounded corners, warm border)

Interactions:
- Player types message → submit calls `onSendMessage(text)`
- Player clicks choice → calls `onSelectChoice(id, label)`
- Close button → calls `onClose()`
- Streaming indicator shown when `isStreaming` is true

Success criteria:
* Panel renders/hides based on `isOpen` prop
* Text displays and auto-scrolls
* Choice buttons render from `choices` prop
* Text input allows sending messages via callback
* No imports from narrative-bridge or AI SDK

Context references:
* UI-prompt.md - Dialogue UI requirements ("Styled like a cozy RPG conversation window")
* specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 200-215) - Layout diagram

Dependencies:
* None (pure React component)

### Step 4.2: Create HudPanel overlay shell (NPC list with moods, clue inventory)

Create a React DOM overlay positioned on the left side of the game container. Shows all NPCs with their current mood indicators and a collapsible clue inventory section.

Files:
* src/components/overlay/hud-panel.tsx - New file

Props interface:
```tsx
interface HudPanelProps {
  personas: { id: string; name: string; mood: string }[];
  clues: { id: string; title: string; description: string }[];
}
```

Layout:
- Fixed on left side, ~200px wide, full height
- NPC Section header "Suspects"
- Vertical list of persona entries: colored mood dot + name + mood text
- Clue Section header "Evidence" (collapsible)
- List of discovered clues: title, one-line description
- Dark semi-transparent background matching dialogue panel aesthetic

Mood dot uses same color mapping as NPC component (calm=blue, nervous=yellow, etc.)

Success criteria:
* All personas listed with name and mood indicator
* Mood color dot updates when mood prop changes
* Discovered clues appear in collapsible inventory
* Panel is always visible during gameplay
* No imports from bridge or backend schemas

Context references:
* UI-prompt.md - HUD requirements ("vertical HUD panel, shows all NPCs")

Dependencies:
* None (pure React component)

### Step 4.3: Create AccusationModal overlay shell (NPC selection grid)

Create a React DOM modal overlay that appears when triggered. Presents a grid of NPC cards for the player to select as the culprit.

Files:
* src/components/overlay/accusation-modal.tsx - New file

Props interface:
```tsx
interface AccusationModalProps {
  isOpen: boolean;
  personas: { id: string; name: string; mood: string }[];
  onAccuse: (personaId: string) => void;
  onCancel: () => void;
}
```

Layout:
- Centered modal, dark overlay dims the background
- Title: "Who is the murderer?"
- Grid of NPC cards (name + mood color border)
- Click card to select → highlight with border
- Confirm button (disabled until selection made) → calls `onAccuse(selectedId)`
- Cancel button → calls `onCancel()`

Success criteria:
* Modal shows all NPCs as selectable cards
* Selection highlights chosen NPC with visual indicator
* Confirm fires onAccuse callback with selected persona ID
* Cancel closes modal without side effects
* No imports from bridge or backend

Context references:
* UI-prompt.md - Accusation mechanic requirements
* specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 200-215) - Layout diagram

Dependencies:
* None (pure React component)

## Implementation Phase 5: Game Shell Integration

<!-- parallelizable: false -->

### Step 5.1: Rewrite game-interface.tsx as React shell combining PIXIJS canvas + DOM overlays

Replace the current text-chat-based GameInterface with a new layout that assembles the PIXIJS canvas and DOM overlays. This component manages local game engine state (player position tracking, nearby entity, overlay visibility) and delegates external actions to callback props.

Files:
* src/components/game/game-interface.tsx - Rewrite existing file

Architecture:
- Relative container (full viewport, 960x640)
- PixiCanvas (z-0): GameWorld → Player, NPC[], ClueObject[], InteractionPrompt
- HudPanel (z-20, absolute left): NPC list + clue inventory
- DialoguePanel (z-10, absolute bottom): text + choices + input
- AccusationModal (z-30): shown when accusation interaction triggered
- `pointer-events: none` on overlay containers, `pointer-events: auto` on interactive DOM elements

Props interface for external integration:
```tsx
export interface GameInterfaceProps {
  /** Game state from the backend */
  personas: { id: string; name: string; mood: string }[];
  clues: { id: string; title: string; description: string }[];
  /** Dialogue state (driven by bridge in the bridge plan) */
  dialogueText: string;
  dialogueIsStreaming: boolean;
  dialogueChoices: { id: string; label: string }[] | null;
  dialoguePersonaId: string | null;
  /** Callbacks for external integration */
  onInteract: (entity: { type: 'npc' | 'clue' | 'accusation'; id: string }) => void;
  onSendMessage: (message: string) => void;
  onSelectChoice: (choiceId: string, choiceLabel: string) => void;
  onAccuse: (personaId: string) => void;
  onCloseDialogue: () => void;
}
```

Internal state:
- `nearbyEntity` — tracked by Player's onNearbyEntity callback
- `showAccusation` — toggled when accusation point interaction fires
- `mapLayout` — computed from `personas` prop via `createDefaultMapLayout`

Flow (engine-only, no bridge):
1. Personas prop arrives → compute MapLayout
2. Player moves with WASD → Player component handles
3. Player near NPC → InteractionPrompt visible
4. Player presses E near NPC → fires `onInteract({ type: 'npc', id })` callback
5. DialoguePanel renders from dialogue* props
6. Player presses E near accusation point → shows AccusationModal

Success criteria:
* PIXIJS canvas renders with room, player, NPCs, and clues
* DOM overlays layer correctly over canvas with proper z-index
* All interactions delegate to callback props
* No AI SDK or bridge imports in this file

Context references:
* src/components/game/game-interface.tsx - Current file (full rewrite)
* specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 196-215) - Layout architecture

Dependencies:
* All Phases 1-4 completion

### Step 5.2: Update page.tsx with dynamic import (SSR disabled)

Update the root page to use Next.js `dynamic` import with `ssr: false` to prevent PIXIJS from being imported on the server.

Files:
* src/app/page.tsx - Modify existing file (5 lines)

For the game engine plan, create a simple wrapper page that passes mock/default props:

```tsx
import dynamic from 'next/dynamic';

const GameInterface = dynamic(
  () => import('@/components/game/game-interface').then(mod => ({ default: mod.GameInterface })),
  { ssr: false },
);

export default function Home() {
  return <GameInterface
    personas={[]}
    clues={[]}
    dialogueText=""
    dialogueIsStreaming={false}
    dialogueChoices={null}
    dialoguePersonaId={null}
    onInteract={() => {}}
    onSendMessage={() => {}}
    onSelectChoice={() => {}}
    onAccuse={() => {}}
    onCloseDialogue={() => {}}
  />;
}
```

Note: The bridge plan will replace these empty props/callbacks with actual bridge wiring.

Success criteria:
* Page renders without SSR errors
* PIXIJS only loads in the browser
* GameInterface renders correctly after client-side hydration (empty room with player moving)

Context references:
* specs/research/subagents/2026-04-20/pixijs-nextjs-integration.md (Lines 85-100) - Dynamic import pattern
* src/app/page.tsx (Lines 1-5) - Current page

Dependencies:
* Step 5.1 completion

## Implementation Phase 6: Validation

<!-- parallelizable: false -->

### Step 6.1: Run full project validation

Execute all validation commands for the project:
* `npm run lint` - ESLint across all files
* `npm run build` - Next.js production build (type checking + bundling)
* `npm test` - Vitest test suite

### Step 6.2: Fix minor validation issues

Iterate on lint errors, build warnings, and test failures. Apply fixes directly when corrections are straightforward and isolated.

### Step 6.3: Report blocking issues

When validation failures require changes beyond minor fixes:
* Document the issues and affected files.
* Provide the user with next steps.
* Recommend additional research and planning rather than inline fixes.

## Dependencies

* pixi.js@^8.18.1
* @pixi/react@^8.0.5
* No AI SDK, workflow, or backend dependencies
* Placeholder sprites via Graphics draw calls

## Success Criteria

* Full game engine loop works: render room → player moves → proximity detection → E interaction → callbacks fire
* PIXIJS renders at 60fps with ~10 entities
* All DOM overlay shells render with correct layout and accept callback props
* No direct imports from src/lib/narrative-bridge.ts or src/workflows/ in any engine file
* No TypeScript errors, lint passes, tests pass
