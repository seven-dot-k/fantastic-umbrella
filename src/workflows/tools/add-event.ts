import { z } from "zod";
import type { GameEvent } from "../schemas/game-state";

/**
 * Tool: add_event
 *
 * Allows a persona to emit a visible event (e.g. "burst into tears",
 * "nervously knocked over a glass"). The event is added to the global
 * events list and optionally shifts the persona's mood/sanity.
 *
 * This tool is a closure — it captures the persona identity and a callback
 * to mutate the shared game state.
 */
export function createAddEventTool(
  personaId: string,
  personaName: string,
  onEvent: (event: GameEvent, moodUpdate?: { mood?: string; sanityDelta?: number }) => void,
) {
  return {
    description:
      "Do something dramatic that everyone can see. Examples: 'dramatically gasps and knocks over a vase', 'nervously laughs way too loud', 'spills drink all over the detective', 'fans self while sweating profusely'. Keep it fun! Optionally update your mood and sanity.",
    inputSchema: z.object({
      description: z
        .string()
        .describe("A short third-person description of the visible action or reaction"),
      newMood: z
        .string()
        .optional()
        .describe("Your new emotional state after this event, e.g. 'distraught', 'furious'"),
      sanityDelta: z
        .number()
        .min(-30)
        .max(10)
        .optional()
        .describe("How much your sanity changes (-30 to +10). Negative for destabilizing events."),
    }),
    execute: async ({
      description,
      newMood,
      sanityDelta,
    }: {
      description: string;
      newMood?: string;
      sanityDelta?: number;
    }) => {
      const event: GameEvent = {
        id: `evt-${personaId}-${Date.now()}`,
        timestamp: Date.now(),
        personaId,
        personaName,
        description,
      };

      onEvent(event, { mood: newMood, sanityDelta });

      return {
        success: true,
        event: {
          description: event.description,
          timestamp: event.timestamp,
        },
      };
    },
  };
}
