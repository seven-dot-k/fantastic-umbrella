<!-- markdownlint-disable-file -->
# Planning Log: PIXIJS Game Engine

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: Sprite/art pipeline tooling (Aseprite, Piskel) for creating cute pixel-art assets
  * Source: specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 545-548)
  * Reason: Art asset creation is outside the scope of code implementation. Plan uses placeholder sprites (colored shapes via Graphics).
  * Impact: medium — the game will be functional but visually placeholder until art is created

* DR-02: AnimatedSprite patterns for NPC idle and player walk animations
  * Source: specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 550-552)
  * Reason: Animation requires sprite sheet assets that don't exist yet. Static sprites are used initially.
  * Impact: low — functionality is correct, animation is polish

* DR-03: Camera/viewport scrolling for rooms larger than the screen
  * Source: specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 554-556)
  * Reason: Initial room dimensions (960x640) fit the viewport. Camera can be added later if needed.
  * Impact: low — single-room game fits viewport

* DR-04: Performance profiling @pixi/react reconciler with game tick loop
  * Source: specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 558-560)
  * Reason: Premature optimization. ~10 entities should have negligible reconciler overhead.
  * Impact: low — can profile after initial implementation if FPS issues arise

* DR-05: @pixi/tilemap integration for tile-based room rendering
  * Source: specs/research/subagents/2026-04-20/pixijs-nextjs-integration.md (Lines 310-330)
  * Reason: Tilemap requires a tile set spritesheet. Plan uses Graphics-drawn rectangles for room and furniture initially.
  * Impact: low — functional for single-room game

* DR-06: React strict mode double-mount with @pixi/react
  * Source: specs/research/subagents/2026-04-20/pixijs-nextjs-integration.md (Lines 183-185)
  * Reason: Documented issue #602. @pixi/react handles destroy on unmount. Double init/destroy in dev is acceptable.
  * Impact: low — dev-mode only behavior, no production impact

### Plan Deviations from Research

* DD-01: Using @pixi/react declarative approach instead of raw imperative PixiJS
  * Research recommends: @pixi/react for simpler developer experience with ~10 entities
  * Plan implements: @pixi/react with `extend()` pattern, `useTick` for game loop
  * Rationale: Research confirms reconciler overhead is negligible for this entity count

* DD-02: GameInterface uses callback props instead of direct bridge integration
  * Research recommends: Single integrated GameInterface component with both engine and bridge
  * Plan implements: Prop-driven GameInterface with callbacks for all external actions
  * Rationale: User requested splitting engine and bridge into separate plans. Callback interface enables clean plan boundaries and independent implementation/testing.

## Implementation Paths Considered

### Selected: @pixi/react Declarative with DOM Overlays + Callback Props

* Approach: Use @pixi/react v8 reconciler for game world rendering. DOM overlays as pure React shells accepting props and firing callbacks. No AI SDK dependencies in the engine layer.
* Rationale: Clean separation of concerns. Engine can be developed and tested independently. Callback interface enables the bridge plan to wire in without engine changes.
* Evidence: specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 296-320)

### IP-01: Raw PixiJS with useRef/useEffect (No @pixi/react)

* Approach: Imperative game loop driven by requestAnimationFrame. Game state in plain objects.
* Trade-offs: Full control, no reconciler overhead, but more boilerplate. Manual cleanup.
* Rejection rationale: Game is simple enough that @pixi/react declarative approach is cleaner.

### IP-02: Integrated engine + bridge in a single plan

* Approach: Single plan covering both game rendering and AI SDK integration.
* Trade-offs: Fewer files, single implementation pass. But tightly couples engine and bridge concerns.
* Rejection rationale: User explicitly requested separate plans for engine and bridge.

## Suggested Follow-On Work

* WI-01: Pixel Art Asset Pipeline — Create cute pixel-art sprites for player, NPCs, room furniture, and clue objects (medium priority)
  * Source: DR-01, UI-prompt.md "soft, cute pixel-art aesthetic"
  * Dependency: Phase 3 completion (game components exist to receive sprites)

* WI-02: Sprite Animation System — Add AnimatedSprite-based idle/walk animations (low priority)
  * Source: DR-02, UI-prompt.md "simple idle animation"
  * Dependency: WI-01 (sprite assets needed)

* WI-03: Camera/Viewport System — Add pixi-viewport for scrolling if room exceeds screen bounds (low priority)
  * Source: DR-03
  * Dependency: Phase 3 completion

* WI-04: Tilemap Room Rendering — Replace Graphics-drawn background with @pixi/tilemap (low priority)
  * Source: DR-05
  * Dependency: WI-01 (tile set spritesheet needed)

* WI-05: Sound and Music — Add ambient music and sound effects for interactions (low priority)
  * Source: UI-prompt.md cozy aesthetic implies audio
  * Dependency: Phase 5 completion
