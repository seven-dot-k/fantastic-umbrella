"use client";

import GameInterfaceClient from "@/components/game/game-interface-client";
import { mockClues, mockPersonas } from "@/lib/data/game-scenario";

/**
 * Temporary engine-validation page. Renders the game shell with mock scenario
 * data so the PIXIJS canvas, HUD, and interaction overlays can be exercised
 * end-to-end before the backend bridge plan is implemented.
 *
 * All dialogue/accusation callbacks are inert stubs for now; the bridge plan
 * will replace them with real game-state handlers.
 */
export default function Home() {
  return (
    <GameInterfaceClient
      personas={mockPersonas}
      clues={mockClues}
      dialogueText=""
      dialogueIsStreaming={false}
      dialogueChoices={null}
      dialoguePersonaId={null}
      onInteract={(entity) => {
        console.log("[v0] onInteract", entity);
      }}
      onSendMessage={(message) => {
        console.log("[v0] onSendMessage", message);
      }}
      onSelectChoice={(choiceId, choiceLabel) => {
        console.log("[v0] onSelectChoice", choiceId, choiceLabel);
      }}
      onAccuse={(personaId) => {
        console.log("[v0] onAccuse", personaId);
      }}
      onCloseDialogue={() => {
        console.log("[v0] onCloseDialogue");
      }}
    />
  );
}
