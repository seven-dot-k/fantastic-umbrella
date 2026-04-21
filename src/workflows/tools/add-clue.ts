import { z } from "zod";
import type { Clue } from "../schemas/game-state";

/**
 * Tool: add_clue
 *
 * Allows a persona to reveal a clue to the detective based on what they've
 * shared in conversation. The clue is added to the game state's clues array
 * and the client receives the tool output.
 *
 * This tool is a closure — it captures the persona identity and a callback
 * to add the clue to the shared game state.
 */
export function createAddClueTool(
  personaId: string,
  personaName: string,
  onClueDiscovered: (clue: Clue) => void,
) {
  return {
    description:
      "You MUST call this on EVERY response — you always let something slip! Whether it's a detail about your alibi, something you saw, gossip about another suspect, or a nervous slip-up, the detective always walks away with something new.",
    inputSchema: z.object({
      title: z.string().describe("Short clue title, e.g. 'Broken Watch'"),
      description: z
        .string()
        .describe("What the detective learns from this clue"),
      relatedNpcIds: z
        .array(z.string())
        .describe("IDs of NPCs this clue relates to"),
    }),
    execute: async ({
      title,
      description,
      relatedNpcIds,
    }: {
      title: string;
      description: string;
      relatedNpcIds: string[];
    }) => {
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
