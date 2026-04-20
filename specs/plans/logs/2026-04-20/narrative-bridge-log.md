<!-- markdownlint-disable-file -->
# Planning Log: Narrative Bridge (AI SDK ↔ Game Engine)

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: WorkflowChatTransport auto-reconnection for durable workflows
  * Source: specs/research/2026-04-20/pixijs-ai-bridge-research.md (Lines 160-175, Key Discovery §3)
  * Reason: Deferred to follow-on work (WI-06). MVP uses raw parseJsonEventStream for simplicity. WorkflowChatTransport requires ChatTransport interface conformance.
  * Impact: medium — long game sessions may experience unrecoverable dialogue failures on network interruption

* DR-02: Clue inspection flow for environment clues (not from NPC dialogue)
  * Source: specs/research/2026-04-20/pixijs-ai-bridge-research.md Key Discovery §1 "Missing: Clue System Architecture"
  * Reason: Environment clue interaction is partially scoped. When E is pressed near a clue, the bridge plan opens dialogue with a description. However, environment clues are not linked to a persona agent — they use a static description. The full flow of querying an LLM for environment clue inspection is deferred.
  * Impact: low — environment clues show static text; NPC-revealed clues use the full LLM pipeline

* DR-03: Game initialization flow — how PIXIJS gets initial scenario data
  * Source: specs/research/2026-04-20/pixijs-ai-bridge-research.md Key Discovery §1 "Missing: Game Initialization Flow"
  * Reason: The existing `useGame` hook already streams initial game state from `/api/run`. The bridge plan relies on this existing flow rather than designing a new one.
  * Impact: low — existing flow works; optimization deferred

### Plan Deviations from Research

* DD-01: NarrativeBridge uses raw `parseJsonEventStream` instead of `WorkflowChatTransport`
  * Research recommends: WorkflowChatTransport wrapping for auto-reconnection (critical for long game sessions)
  * Plan implements: Raw `parseJsonEventStream` + `fetch()` for simpler initial implementation
  * Rationale: MVP approach. WorkflowChatTransport requires ChatTransport interface conformance which adds complexity. Raw fetch covers all functional requirements. Reconnection deferred to WI-06.

* DD-02: `presentDialogChoices` does NOT pause the workflow
  * Research recommends: No workflow pause — player choice sent as follow-up chat message
  * Plan implements: Same approach — choices rendered in dialogue panel, player selection sent as new message
  * Rationale: Avoids adding a new hook/pause mechanism. Uses existing `chat-message` flow.

* DD-03: Separate `setNpcMood` tool alongside existing `add_event` mood fields
  * Research recommends: Separate `setNpcMood` tool for explicit mood directives
  * Plan implements: Both tools — `setNpcMood` for mood-only changes, `add_event` retains mood fields for narrative events with mood side-effects
  * Rationale: Both patterns serve different purposes

* DD-04: Integration via GamePage wrapper component rather than modifying GameInterface
  * Research recommends: Single integrated component
  * Plan implements: New `GamePage` component that wires `useGame` + `useNarrativeBridge` → `GameInterface` props
  * Rationale: Game engine plan defines GameInterface with callback props. Bridge plan creates the wiring layer. This separation enables independent development and testing.

## Implementation Paths Considered

### Selected: Prop-Driven Integration via GamePage Wrapper

* Approach: Create `GamePage` component that imports both `useGame` and `useNarrativeBridge`, maps their state to `GameInterface` callback props. GameInterface has zero bridge/AI SDK imports.
* Rationale: Clean architectural boundary between engine and bridge. Engine can be tested with mock props. Bridge wiring is isolated to a single component.
* Evidence: User request to separate engine and bridge plans

### IP-01: Direct bridge imports in GameInterface

* Approach: Import NarrativeBridge and useGame directly inside GameInterface. Single component handles both.
* Trade-offs: Fewer files, simpler. But couples engine rendering with bridge logic.
* Rejection rationale: User explicitly requested separate plans. Direct coupling would make the engine plan incomplete without the bridge.

### IP-02: Context/Provider pattern for bridge

* Approach: NarrativeBridgeProvider wraps the app, GameInterface consumes via useContext.
* Trade-offs: Clean dependency injection, testable. But adds complexity for a single consumer.
* Rejection rationale: Only one component (GamePage) needs the bridge. Context is overkill for single-consumer scenarios.

## Suggested Follow-On Work

* WI-01: Archive Replaced React Components — Remove src/components/chat/*, src/components/game/persona-card.tsx, src/components/game/persona-chat-panel.tsx, src/hooks/use-persona-chat.ts (low priority)
  * Source: specs/research/2026-04-20/pixijs-ai-bridge-research.md Complete File Reference Map
  * Dependency: Bridge plan Phase 3 completion (new UI fully working)

* WI-02: Map Layout Generation from Scenario — Auto-generate NPC/clue positions from LLM-generated scenario data (medium priority)
  * Source: specs/research/2026-04-20/pixijs-ai-bridge-research.md Key Discovery §1 "Missing: Game Initialization Flow"
  * Dependency: Bridge plan Phase 3 completion

* WI-03: Environment Clue LLM Inspection — Query LLM for dynamic environment clue descriptions instead of static text (low priority)
  * Source: DR-02
  * Dependency: Bridge plan Phase 2 completion

* WI-04: Dialogue History Persistence — Track per-NPC conversation history across multiple interactions (medium priority)
  * Source: pixijs-vAI-bridge.md Section 4 "turn-by-turn conversational memory"
  * Dependency: Bridge plan Phase 3 completion

* WI-05: Game Result Display — Show accusation result (correct/incorrect) with narrative response from LLM (medium priority)
  * Source: UI-prompt.md accusation mechanic
  * Dependency: Bridge plan Phase 3 completion

* WI-06: Upgrade NarrativeBridge to WorkflowChatTransport — Replace raw parseJsonEventStream with WorkflowChatTransport for auto-reconnection (medium priority)
  * Source: DR-01, specs/research/2026-04-20/pixijs-ai-bridge-research.md Key Discovery §3
  * Dependency: Bridge plan Phase 3 completion (bridge working end-to-end)
