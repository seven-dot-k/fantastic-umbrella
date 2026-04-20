import { z } from "zod";

/**
 * Tool: set_npc_mood
 *
 * Allows a persona to explicitly update their visible mood that the detective
 * can observe. Used when the persona's emotional state changes during conversation.
 *
 * This tool is a closure — it captures the persona identity and a callback
 * to update the game state with the new mood.
 */
export function createSetNpcMoodTool(
  personaId: string,
  onMoodUpdate: (personaId: string, mood: string, intensity?: number) => void,
) {
  return {
    description:
      "Update your visible mood that the detective can observe. Use when your emotional state changes during conversation.",
    inputSchema: z.object({
      mood: z
        .string()
        .describe(
          "New mood: nervous, calm, defensive, suspicious, angry, relieved, etc.",
        ),
      intensity: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .describe("How strongly this mood shows, 1-10"),
    }),
    execute: async ({
      mood,
      intensity,
    }: {
      mood: string;
      intensity?: number;
    }) => {
      onMoodUpdate(personaId, mood, intensity);
      return { success: true, mood, intensity };
    },
  };
}
