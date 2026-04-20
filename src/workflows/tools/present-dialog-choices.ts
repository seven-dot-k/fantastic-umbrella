import { z } from "zod";

/**
 * Tool: present_dialog_choices
 *
 * Presents the detective with a set of dialogue options to choose from. The
 * player's selection comes back as a follow-up chat message — there is no
 * workflow pause mechanism. The client bridge renders the options as buttons
 * and, when clicked, dispatches the selected label as a standard chat message.
 */
export function createPresentDialogChoicesTool() {
  return {
    description:
      "Present the detective with specific dialogue options to choose from. Use when the conversation reaches a natural branching point.",
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
