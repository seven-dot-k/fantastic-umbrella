# PIXIJS v8 + Next.js 15 App Router Integration Research

## Research Questions

1. PIXIJS v8 Installation and Setup - packages, versions, SSR compatibility
2. Next.js Integration Patterns - App Router, client directives, dynamic imports
3. @pixi/react - official React wrapper status, version compatibility
4. Canvas vs DOM Overlay - patterns for overlaying React components on PIXIJS canvas
5. PIXIJS Game Architecture - scene management, entities, input, tilemaps, collision
6. Asset Loading - textures, spritesheets, Next.js public folder patterns

---

## 1. PIXIJS v8 Installation and Setup

### Current Versions (as of April 2026)

| Package | Version | Notes |
|---------|---------|-------|
| `pixi.js` | **8.18.1** | Latest stable, published ~6 days ago |
| `@pixi/react` | **8.0.5** | Latest stable, published ~5 months ago (Dec 2025) |
| `@pixi/tilemap` | **5.0.2** | v5.x works with PixiJS v8 |

### Installation

```bash
npm install pixi.js@^8.18.1 @pixi/react@^8.0.5
```

### SSR Compatibility

**PixiJS v8 CANNOT run server-side.** It requires WebGL/WebGPU rendering contexts which only exist in the browser. Key facts:

- PixiJS instantiates `Application` which needs a `<canvas>` element and GPU rendering context
- `@pixi/react` uses `useIsomorphicLayoutEffect` internally - returns `useEffect` on server, `useLayoutEffect` on client (source: `src/hooks/useIsomorphicLayoutEffect.ts` in pixi-react)
- The `<Application>` component renders a `<canvas ref={canvasRef}>` element
- Worker APIs referenced internally (issue #475: "ReferenceError: Worker is not defined") confirm PixiJS attempts browser API access at import time

**Conclusion:** PixiJS must be loaded client-only. On the server, the module should not be imported at all.

### PixiJS v8 Key Changes from v7

- `Application` now uses async `app.init()` rather than constructor options
- WebGPU renderer support added alongside WebGL
- New `eventMode` replaces old `interactive` boolean
- `Assets` singleton replaces older loader pattern
- TreeShaking via `extend()` pattern in @pixi/react

---

## 2. Next.js App Router Integration Patterns

### Required: `"use client"` Directive

Any component that imports `pixi.js` or `@pixi/react` MUST use the `"use client"` directive. Next.js App Router defaults to Server Components, and PixiJS cannot be imported on the server.

### Pattern A: Direct Client Component (Recommended with @pixi/react)

```tsx
// src/components/game/pixi-canvas.tsx
"use client";

import { Application, extend } from '@pixi/react';
import { Container, Sprite, Graphics } from 'pixi.js';
import { useRef } from 'react';

extend({ Container, Sprite, Graphics });

export function PixiCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Application resizeTo={containerRef}>
        {/* Pixi children here */}
      </Application>
    </div>
  );
}
```

### Pattern B: Dynamic Import with SSR Disabled

For cases where even the *import* of pixi.js causes issues on the server:

```tsx
// src/app/page.tsx (Server Component)
import dynamic from 'next/dynamic';

const GameCanvas = dynamic(
  () => import('@/components/game/pixi-canvas').then(mod => mod.PixiCanvas),
  { ssr: false }
);

export default function Page() {
  return (
    <div className="h-screen w-screen">
      <GameCanvas />
    </div>
  );
}
```

### Pattern C: Raw PixiJS with useRef/useEffect (No @pixi/react)

```tsx
"use client";

import { useEffect, useRef } from 'react';

export function RawPixiCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<any>(null);

  useEffect(() => {
    let app: any;

    const init = async () => {
      const PIXI = await import('pixi.js');
      app = new PIXI.Application();
      await app.init({
        background: '#1a1a2e',
        resizeTo: containerRef.current!,
      });
      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;
    };

    init();

    return () => {
      app?.destroy(true, { children: true });
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
```

### Gotchas

- **Issue #551 (closed):** Next.js 15 + React 19 was incompatible until @pixi/react 8.0.0-beta.17. Now **fixed** in @pixi/react 8.0.5.
- **Issue #475:** "Worker is not defined" - confirms need for client-only rendering.
- **Issue #602 (open):** React strict mode creates double-mount issues with `<Application>`. Workaround: disable strict mode for the PixiJS component tree, or accept the double init/destroy cycle in dev.
- **Cleanup:** @pixi/react v8 handles `destroy()` on unmount via `destroyOptions` and `rendererDestroyOptions` props on `<Application>`.

---

## 3. @pixi/react

### Status

- **Official:** Yes, maintained under `pixijs/pixi-react` GitHub org
- **Production-ready:** Yes, described as "open-source, production-ready"
- **Version:** 8.0.5 (released Dec 2025)
- **React 19:** Supported
- **PixiJS v8:** Supported
- **Weekly downloads:** ~51,000
- **Stars:** 2,800+

### Architecture: React Reconciler

`@pixi/react` v8 uses a custom React reconciler (via `react-reconciler`) which creates a parallel render tree for PixiJS objects. This is the same pattern used by `@react-three/fiber`.

### Key APIs

| Export | Purpose |
|--------|---------|
| `Application` | Root component wrapping PixiJS Application |
| `extend` | Register PixiJS classes for JSX usage |
| `useApplication` | Access `app` instance from child components |
| `useExtend` | Memoized version of `extend` as a hook |
| `useTick` | Attach callback to the app ticker |
| `createRoot` | Lower-level API for custom mounting |

### `extend` Pattern (Tree-Shaking)

```tsx
import { Container, Sprite, Graphics, Text } from 'pixi.js';
import { extend } from '@pixi/react';

// Register only what you need
extend({ Container, Sprite, Graphics, Text });

// Now available as JSX:
// <pixiContainer>, <pixiSprite>, <pixiGraphics>, <pixiText>
```

### Component Naming Convention

All PixiJS components use `pixi` prefix: `<pixiContainer>`, `<pixiSprite>`, `<pixiGraphics>`, `<pixiText>`, `<pixiAnimatedSprite>`, `<pixiTilingSprite>`.

Unprefixed elements can be enabled via TypeScript declaration:

```ts
// global.d.ts
import { type UnprefixedPixiElements } from '@pixi/react';
declare module '@pixi/react' {
  interface PixiElements extends UnprefixedPixiElements {}
}
```

### Recommendation: Use @pixi/react

For this project, `@pixi/react` is the recommended approach because:
- Declarative scene graph maps well to React component patterns
- Hooks (`useTick`, `useApplication`) integrate with React lifecycle
- Proper cleanup on unmount
- TypeScript support built-in
- Active maintenance, React 19 + PixiJS v8 support confirmed

The raw `useRef/useEffect` approach is viable for complex custom rendering or when @pixi/react abstractions get in the way of imperative game loops.

---

## 4. Canvas vs DOM Overlay

### Pattern: Absolute Positioning with z-index

The standard pattern is to use a relative container with the PixiJS canvas and React DOM overlays as absolute-positioned siblings:

```tsx
"use client";

export function GameLayout() {
  return (
    <div className="relative w-full h-full">
      {/* PixiJS Canvas (z-index: 0) */}
      <div className="absolute inset-0 z-0">
        <PixiCanvas />
      </div>

      {/* DOM Overlay: Dialogue Panel (z-index: 10) */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-auto">
        <DialoguePanel />
      </div>

      {/* DOM Overlay: HUD (z-index: 20) */}
      <div className="absolute top-4 right-4 z-20 pointer-events-auto">
        <HUD />
      </div>
    </div>
  );
}
```

### Pointer Event Passthrough

- Set `pointer-events: none` on overlay containers that should pass clicks to the canvas
- Set `pointer-events: auto` on specific interactive DOM elements (buttons, inputs)
- The canvas itself naturally receives pointer events for PixiJS interaction

```css
.overlay-container {
  pointer-events: none; /* pass through to canvas */
}
.overlay-container .interactive-element {
  pointer-events: auto; /* this element captures clicks */
}
```

### @pixi/react Context Bridge

`@pixi/react` v8 uses `its-fine`'s `FiberProvider` and `useContextBridge` internally, meaning React context from the DOM tree IS available inside the `<Application>` children. This was a pain point in v7 but is resolved in v8.

---

## 5. PIXIJS Game Architecture

### Scene Management

PixiJS uses a container hierarchy. Scenes are typically top-level containers added/removed from `app.stage`:

```tsx
"use client";

import { useState } from 'react';
import { Application, extend } from '@pixi/react';
import { Container } from 'pixi.js';

extend({ Container });

function GameWorld() {
  return (
    <pixiContainer>
      {/* Tilemap layer */}
      {/* Entity layer (player, NPCs) */}
      {/* Interaction zones layer */}
    </pixiContainer>
  );
}

function UIOverlay() {
  return (
    <pixiContainer>
      {/* In-game UI elements rendered in PixiJS */}
    </pixiContainer>
  );
}
```

### Entity System Pattern

```tsx
function Player({ x, y, texture }: { x: number; y: number; texture: string }) {
  return <pixiSprite texture={texture} x={x} y={y} anchor={0.5} />;
}

function NPC({ x, y, texture, interactionRadius }: NPCProps) {
  return (
    <pixiContainer x={x} y={y}>
      <pixiSprite texture={texture} anchor={0.5} />
      {/* Interaction zone visualized as debug graphics */}
    </pixiContainer>
  );
}
```

### Input Handling (Keyboard - WASD + E)

PixiJS does NOT have built-in keyboard handling. Use DOM `keydown`/`keyup` events:

```tsx
"use client";

import { useEffect, useRef, useCallback } from 'react';
import { useTick } from '@pixi/react';

function useKeyboard() {
  const keys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase());
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return keys;
}

function PlayerController() {
  const keys = useKeyboard();
  const posRef = useRef({ x: 400, y: 300 });
  const speed = 3;

  useTick(useCallback((ticker) => {
    const dt = ticker.deltaTime;
    if (keys.current.has('w')) posRef.current.y -= speed * dt;
    if (keys.current.has('s')) posRef.current.y += speed * dt;
    if (keys.current.has('a')) posRef.current.x -= speed * dt;
    if (keys.current.has('d')) posRef.current.x += speed * dt;
    if (keys.current.has('e')) { /* trigger interaction */ }
  }, []));

  return <pixiSprite x={posRef.current.x} y={posRef.current.y} texture="player" anchor={0.5} />;
}
```

**Note on useTick:** The callback must be memoized (`useCallback`) to prevent being re-added each frame.

### PixiJS Click/Pointer Interaction on Sprites

```tsx
<pixiSprite
  texture="npc"
  eventMode="static"
  cursor="pointer"
  onPointerDown={(e) => handleInteraction(e)}
/>
```

Event modes: `'none'` | `'passive'` | `'auto'` | `'static'` | `'dynamic'`

### Sprite/Tilemap for 2D Top-Down Room

Using `@pixi/tilemap` (v5.0.2 for PixiJS v8):

```bash
npm install @pixi/tilemap@^5.0.2
```

```tsx
import { CompositeTilemap } from '@pixi/tilemap';
import { Assets } from 'pixi.js';

// Load tileset spritesheet
const sheet = await Assets.load('tilesheet.json');
const tilemap = new CompositeTilemap();

// Place tiles at grid positions
for (let y = 0; y < mapHeight; y++) {
  for (let x = 0; x < mapWidth; x++) {
    const tileId = mapData[y][x];
    tilemap.tile(tileTextures[tileId], x * TILE_SIZE, y * TILE_SIZE);
  }
}
```

For simpler cases (murder mystery room), a single background sprite with interaction zones overlaid may be sufficient:

```tsx
<pixiContainer>
  <pixiSprite texture="room-background" />
  {interactionZones.map(zone => (
    <pixiGraphics
      key={zone.id}
      x={zone.x}
      y={zone.y}
      eventMode="static"
      hitArea={new Rectangle(0, 0, zone.width, zone.height)}
      onPointerDown={() => handleZoneInteract(zone)}
      draw={(g) => {
        // Optional: draw debug visualization
        g.clear();
        g.setFillStyle({ color: 0xffffff, alpha: 0.01 });
        g.rect(0, 0, zone.width, zone.height);
        g.fill();
      }}
    />
  ))}
</pixiContainer>
```

### Collision Detection (Simple Rectangular Zones)

PixiJS v8 does not include physics or collision detection. For simple AABB (axis-aligned bounding box) collision:

```tsx
function checkAABBCollision(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// For circular proximity detection (NPC interaction range):
function inRange(player: { x: number; y: number }, npc: { x: number; y: number }, radius: number): boolean {
  const dx = player.x - npc.x;
  const dy = player.y - npc.y;
  return dx * dx + dy * dy <= radius * radius;
}
```

For hit-testing within PixiJS, use custom `hitArea`:

```tsx
sprite.hitArea = new Rectangle(0, 0, width, height);
// or
sprite.hitArea = new Circle(centerX, centerY, radius);
// or custom:
sprite.hitArea = { contains(x, y) { return /* custom logic */; } };
```

---

## 6. Asset Loading

### PixiJS v8 Assets System

The `Assets` singleton handles all loading:

```tsx
import { Assets } from 'pixi.js';

// Basic loading
const texture = await Assets.load('images/sprite.png');

// Multiple assets
const assets = await Assets.load([
  'images/bg.png',
  'images/character.png',
]);

// With aliases
await Assets.load({ alias: 'hero', src: 'images/hero.png' });
const sprite = Sprite.from('hero');

// Bundle-based loading
Assets.addBundle('game', {
  room: 'room.png',
  player: 'player.png',
  npc_detective: 'npc-detective.png',
});
await Assets.loadBundle('game');
```

### Supported File Types

| Type | Extensions |
|------|-----------|
| Textures | .png, .jpg, .gif, .webp, .avif, .svg |
| Sprite Sheets | .json (TexturePacker/Aseprite format) |
| Bitmap Fonts | .fnt, .xml, .txt |
| Web Fonts | .ttf, .otf, .woff, .woff2 |
| JSON | .json |
| Video Textures | .mp4, .webm, .ogg |

### Where to Put Assets in Next.js

Place game assets in the `public/` folder:

```
public/
  game/
    sprites/
      player.png
      npc-butler.png
      npc-detective.png
    rooms/
      study.png
      hallway.png
    tilesets/
      floor-tiles.json
      floor-tiles.png
    ui/
      dialogue-frame.png
```

Then reference with paths relative to the public root:

```tsx
await Assets.load('/game/sprites/player.png');
// or with basePath:
await Assets.init({ basePath: '/game' });
await Assets.load('sprites/player.png');
```

### Spritesheet (Atlas) Format

PixiJS loads TexturePacker-format JSON spritesheets:

```json
{
  "frames": {
    "player-idle-0.png": {
      "frame": { "x": 0, "y": 0, "w": 32, "h": 32 },
      "sourceSize": { "w": 32, "h": 32 }
    },
    "player-idle-1.png": {
      "frame": { "x": 32, "y": 0, "w": 32, "h": 32 },
      "sourceSize": { "w": 32, "h": 32 }
    }
  },
  "meta": {
    "image": "player-sprites.png",
    "size": { "w": 256, "h": 256 }
  }
}
```

After loading, individual frames are accessible by name:

```tsx
await Assets.load('/game/sprites/player.json');
const sprite = Sprite.from('player-idle-0.png');
```

### Background/Progressive Loading

```tsx
// Load critical assets first
await Assets.loadBundle('level-1');
showLevel();

// Background load upcoming levels
Assets.backgroundLoadBundle('level-2');
```

---

## Key Gotchas Summary

1. **Must use `"use client"` or `dynamic(..., { ssr: false })`** - PixiJS crashes on server
2. **React strict mode double-mount** - Creates/destroys Application twice in dev (issue #602, open)
3. **`extend()` required before JSX usage** - forgetting this causes errors
4. **`useTick` callback must be memoized** - or it re-attaches every frame
5. **No built-in keyboard handling** - use DOM events
6. **No built-in collision/physics** - roll your own AABB or use external library
7. **`@pixi/react` 8.0.5 resolves React 19/Next.js 15 incompatibility** (issue #551)
8. **Assets require browser** - load assets in `useEffect` or after `<Application>` mounts

---

## References

- npm pixi.js: https://www.npmjs.com/package/pixi.js (v8.18.1)
- npm @pixi/react: https://www.npmjs.com/package/@pixi/react (v8.0.5)
- npm @pixi/tilemap: https://www.npmjs.com/package/@pixi/tilemap (v5.0.2)
- GitHub pixi-react: https://github.com/pixijs/pixi-react
- PixiJS Assets docs: https://pixijs.com/8.x/guides/components/assets
- PixiJS Events docs: https://pixijs.download/release/docs/events.html
- Issue #551 (Next.js 15 compat, fixed): https://github.com/pixijs/pixi-react/issues/551
- Issue #602 (strict mode, open): https://github.com/pixijs/pixi-react/issues/602
- PixiJS Assets API: https://pixijs.download/release/docs/assets.Assets.html
