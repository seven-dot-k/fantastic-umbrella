import { z } from "zod";

/**
 * Tool: present_dialog_choices
 *
 * Presents the detective with specific dialogue options to choose from.
 * Used when the conversation reaches a natural branching point.
 *
 * The player's selection comes back as a follow-up chat message —
 * no workflow pause mechanism is introduced.
 */
export function createPresentDialogChoicesTool() {
  return {
    description:
      "Present the detective with dialogue options to choose from. You MUST call this after EVERY reply — always give 2-4 fun options for the detective to respond with.",
    inputSchema: z.object({
      prompt: z
        .string()
        .describe("Context for why these choices are being offered"),
      choices: z
        .array(
          z.object({
            id: z.string(),
            label: z.string().describe("The text shown to the player"),
          }),
        )
        .min(2)
        .max(5),
    }),
    execute: async ({
      prompt,
      choices,
    }: {
      prompt: string;
      choices: { id: string; label: string }[];
    }) => {
      return { presented: true, prompt, choices };
    },
  };
}
