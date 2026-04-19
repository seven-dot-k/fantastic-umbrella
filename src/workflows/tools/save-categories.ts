import { z } from "zod";
import { FatalError } from "workflow";
import { saveCategoryUpdates } from "@/lib/data/store";
import { contentApprovalHook } from "@/workflows/hooks/approval";

interface CategoryUpdate {
  id: string;
  content?: { shortDescription: string; longDescription: string };
  seoContent?: { metaTitle: string; metaDescription: string };
}

async function persistCategoryUpdates(updates: CategoryUpdate[]) {
  "use step";

  // Validate each update has at least one content field
  const invalid = updates.filter((u) => !u.content && !u.seoContent);
  if (invalid.length > 0) {
    throw new FatalError(
      `${invalid.length} category update(s) missing both content and seoContent: ${invalid.map((u) => u.id).join(", ")}`,
    );
  }

  try {
    saveCategoryUpdates(updates);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new FatalError(`Failed to persist category updates: ${message}`);
  }

  return {
    saved: updates.length,
    message: `Successfully saved updates for ${updates.length} categories`,
  };
}

// Note: No "use step" here — hooks are workflow-level primitives
async function executeSaveCategories(
  { updates }: { updates: CategoryUpdate[] },
  { toolCallId }: { toolCallId: string },
) {
  // Use the toolCallId as the hook's resumption token — see save-products.ts
  // for the full explanation of why this bridges the UI approval flow.
  const hook = contentApprovalHook.create({ token: toolCallId });
  const { approved, comment } = await hook;

  if (!approved) {
    return { saved: 0, message: `Save rejected: ${comment || "No reason provided"}` };
  }

  return persistCategoryUpdates(updates);
}

export const saveCategoriesToolDef = {
  description:
    "Save approved category content changes. IMPORTANT: Only call this after the user has explicitly approved the changes. This requires human approval.",
  inputSchema: z.object({
    updates: z.array(
      z.object({
        id: z.string(),
        content: z
          .object({
            shortDescription: z.string(),
            longDescription: z.string(),
          })
          .optional(),
        seoContent: z
          .object({
            metaTitle: z.string(),
            metaDescription: z.string(),
          })
          .optional(),
      })
    ).describe("Array of category updates with ID and new content/SEO data"),
  }),
  execute: executeSaveCategories,
};
