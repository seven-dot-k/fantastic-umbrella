import { z } from "zod";
import { FatalError } from "workflow";
import { saveProductUpdates } from "@/lib/data/store";
import { contentApprovalHook } from "@/workflows/hooks/approval";

interface ProductUpdate {
  sku: string;
  content?: { shortDescription: string; longDescription: string };
  seoContent?: { metaTitle: string; metaDescription: string };
}

async function persistProductUpdates(updates: ProductUpdate[]) {
  "use step";

  // Validate each update has at least one content field
  const invalid = updates.filter((u) => !u.content && !u.seoContent);
  if (invalid.length > 0) {
    throw new FatalError(
      `${invalid.length} product update(s) missing both content and seoContent: ${invalid.map((u) => u.sku).join(", ")}`,
    );
  }

  try {
    saveProductUpdates(updates);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new FatalError(`Failed to persist product updates: ${message}`);
  }

  return {
    saved: updates.length,
    message: `Successfully saved updates for ${updates.length} products`,
  };
}

// Note: No "use step" here — hooks are workflow-level primitives
async function executeSaveProducts(
  { updates }: { updates: ProductUpdate[] },
  { toolCallId }: { toolCallId: string },
) {
  // Use the toolCallId as the hook's resumption token so the frontend can
  // correlate pending tool UI parts (identified by toolCallId) with the
  // approval endpoint. When the user clicks Approve/Reject in the UI, the
  // frontend POSTs to /api/hooks/approval with this same toolCallId to resume
  // the workflow. See chat-interface.tsx pendingSaveToolCallIds.
  const hook = contentApprovalHook.create({ token: toolCallId });
  const { approved, comment } = await hook;

  if (!approved) {
    return { saved: 0, message: `Save rejected: ${comment || "No reason provided"}` };
  }

  return persistProductUpdates(updates);
}

export const saveProductsToolDef = {
  description:
    "Save approved product content changes. IMPORTANT: Only call this after the user has explicitly approved the changes in the bulk edit table. This requires human approval.",
  inputSchema: z.object({
    updates: z.array(
      z.object({
        sku: z.string(),
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
    ).describe("Array of product updates with SKU and new content/SEO data"),
  }),
  execute: executeSaveProducts,
};
