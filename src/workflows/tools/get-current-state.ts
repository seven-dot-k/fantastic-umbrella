import { z } from "zod";
import type { GameState } from "../schemas/game-state";

/**
 * Tool: get_current_state
 *
 * Returns the calling persona's current mood, sanity, and recent global events.
 * The persona uses this to stay aware of the evolving situation.
 *
 * This tool is a closure — it captures a mutable reference to the game state
 * so it always returns the latest data without needing a network call.
 */
export function createGetCurrentStateTool(
  personaId: string,
  getGameState: () => GameState,
) {
  return {
    description:
      "Get your current emotional state (mood, sanity) and recent events that have happened during the investigation. Use this to stay aware of the situation.",
    inputSchema: z.object({}),
    execute: async () => {
      const state = getGameState();
      const persona = state.personas.find((p) => p.id === personaId);
      if (!persona) {
        return { error: "Persona not found" };
      }

      const recentEvents = state.events.slice(-10);

      return {
        mood: persona.mood,
        sanity: persona.sanity,
        recentEvents: recentEvents.map((e) => ({
          who: e.personaName,
          what: e.description,
          timestamp: e.timestamp,
        })),
      };
    },
  };
}
