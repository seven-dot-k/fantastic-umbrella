import { defineHook } from "workflow";
import { z } from "zod";

/**
 * Hook for sending game-level events to the PlayGame workflow.
 * Used for actions like accusing a persona or ending the game.
 */
export const gameEventHook = defineHook({
  schema: z.object({
    type: z.enum(["accuse", "end-game", "get-state", "add-event", "update-mood"]),
    personaId: z.string().optional(),
    description: z.string().optional(),
    mood: z.string().optional(),
    sanityDelta: z.number().optional(),
  }),
});
