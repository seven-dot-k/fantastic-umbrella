import { z } from "zod";
import { FatalError } from "workflow";
import { getBrandVoice } from "@/lib/data/brand-voices";

async function executeGetBrandVoice({ catalog }: { catalog?: string }) {
  "use step";

  let voice;
  try {
    voice = getBrandVoice(catalog);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new FatalError(`Failed to retrieve brand voice: ${message}`);
  }

  if (!voice) {
    throw new FatalError(
      `No brand voice found${catalog ? ` for catalog "${catalog}"` : ""}. Content generation requires a brand voice.`,
    );
  }

  return {
    voice,
    message: "Brand voice retrieved successfully",
  };
}

export const getBrandVoiceToolDef = {
  description:
    "Retrieve the brand voice to use for tone and style when generating descriptions or SEO data. Always call this before generating content.",
  inputSchema: z.object({
    catalog: z
      .string()
      .optional()
      .describe("Optional catalog name to get voice for (defaults to Main Store)"),
  }),
  execute: executeGetBrandVoice,
};
